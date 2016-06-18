'use strict';

const request = require('request-promise'),
      CookieStore = require('tough-cookie-file-store'),
      path = require('path'),
      fs = require('fs-jetpack'),
      _ = require('lodash'),
      cheerio = require('cheerio');

class QiwiMaster {

    constructor(qiwiAuthData) {
        if (!qiwiAuthData.phone || !qiwiAuthData.pass)
            throw new Error('Invalid params qiwiAuthData');

        this.qiwiAuth = qiwiAuthData;

        this.requestOptions = {};
        this.request = null;
    }

    createRequest() {
        this.requestOptions = {
            jar: request.jar(new CookieStore(path.join(process.cwd(), 'storage/' + this.qiwiAuth.phone.substring(1) ))),
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; U; Android 4.0.3; ko-kr; LG-L160L Build/IML74K) AppleWebkit/534.30 (KHTML, like Gecko) Version/4.0 Mobile Safari/534.30'
                //,'X-Requested-With': 'XMLHttpRequest'
            },
            resolveWithFullResponse: true
        };

        this.request = request.defaults(this.requestOptions);

        return this.request;
    }

    login() {
        return this.createRequest()(Object.assign(this.requestOptions, {
            url: 'https://sso.qiwi.com/cas/tgts',
            method: 'POST',
            headers: {
                'Referer': 'https://qiwi.com/security.action',
                'Content-Type' : 'application/json',
                'Accept': 'application/vnd.qiwi.sso-v1+json',
                'Accept-Language': 'ru;q=0.8,en-US;q=0.6,en;q=0.4'
            },
            body: JSON.stringify({
                login: this.qiwiAuth.phone,
                password: this.qiwiAuth.pass
            }),
            transform: (body) => {
                return JSON.parse(body);
            }
        })).then(response => {
            if (!response.entity.ticket) {
                throw new Error('Error step1 response property ticket');
            }
           return response.entity.ticket;
        }).then(ticket => {
            return request(Object.assign(this.requestOptions, {
                url: 'https://sso.qiwi.com/cas/sts',
                headers: {
                    'Referer': 'https://sso.qiwi.com/app/proxy?v=1',
                    'Content-Type' : 'application/json',
                    'Accept': 'application/vnd.qiwi.sso-v1+json',
                    'Accept-Language': 'ru-RU,ru;q=0.8,en-US;q=0.6,en;q=0.4'
                },
                body: JSON.stringify({
                    ticket: ticket,
                    service: 'https://qiwi.com/j_spring_cas_security_check'
                })
            }))
        }).then(response => {
            if (!response.entity.ticket) {
                throw new Error('Error step2 not ticket');
            }

            return response.entity.ticket;
        }).then(ticket => {
            return request(Object.assign(this.requestOptions, {
                url: `https://qiwi.com/j_spring_cas_security_check?ticket=${ticket}`,
                method: 'GET',
                headers: {
                    'Referer': 'https://qiwi.com/security.action',
                    'X-Requested-With' : 'XMLHttpRequest',
                    'Accept': 'application/json, text/javascript, **; q=0.01',
                    'Accept-Language': 'ru-RU,ru;q=0.8,en-US;q=0.6,en;q=0.4'
                }
            }));
        }).then(response => {
            if (!response.code || !response.code.value) {
                throw new Error('Error step3 incorrect response');
            }

            return true;
        });
    }

    checkAuth() {
        return this.ssoQiwi();
    }

    ssoQiwi() {
        return this.createRequest()(Object.assign(this.requestOptions, {
            url: 'https://sso.qiwi.com/cas/tgts',
            method: 'GET',
            headers: {
                'Referer': 'https://sso.qiwi.com/app/proxy?v=1',
                'Accept': 'application/vnd.qiwi.sso-v1+json',
                'Content-Type': 'application/json'
            },
            json: true
        })).then(response => {
            if (!_.has(response, 'body.entity.ticket')) {
                throw new Error('Erorr sso server request');
            }

            return response.body.entity.ticket;
        });
    }

    getBalance() {
        return this.createRequest()(Object.assign(this.requestOptions, {
            url: 'https://qiwi.com/person/state.action',
            method: 'POST',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Referer': 'https://qiwi.com/security.action',
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'Accept-Language': 'ru-RU,ru;q=0.8,en-US;q=0.6,en;q=0.4'
            },
            json: true
        })).then(response => {
            if (!_.has(response, 'body.data.balances')) {
                throw new Error('Error get balance incorrect response');
            }

            return response.body.data.balances.RUB;
        });
    }

    getHistoryWeek() {
        return this.createRequest()(Object.assign(this.requestOptions, {
            url: 'https://qiwi.com/report/list.action?type=3&settings=true&paymentModeType=QIWI&paymentModeValue=RUB',
            method: 'GET',
            resolveWithFullResponse: true
        })).then(response => {
            let transcations = this.parseTransactions(response.body);

            return transcations;
        });
    }

    parseTransactions(html) {
        var $ = cheerio.load(html, {decodeEntities: true});

        var transcations = $('.reportsLine').map((i, elem) => {
            if (i == 0) return;
            let el = $(elem);

            let parseAmount = (string) => {
                let matches = string.replace(/\s/, '').match(/(\d*,\d*)/);

                return +matches[0].replace(',', '.');
            };

            return {
                status: el.hasClass('status_SUCCESS'),
                date: el.find('.date').text().trim(),
                time: el.find('.time').text().trim(),
                transaction: el.find('.transaction').text().trim(),
                provider: el.find('.ProvWithComment').text().trim(),
                comment: el.find('.ProvWithComment').find('.comment').text().trim() || null,
                amount: parseAmount(el.find('.originalExpense').find('span').text().trim()),
                income: el.find('.income').length ? parseAmount(el.find('.income .cash').text().trim()) : false,
                expenditure: el.find('.expenditure').length ? parseAmount(el.find('.expenditure .cash').text().trim()) : false,
                commission: el.find('.expenditure').find('.commission').text().trim() != '' ? parseAmount(el.find('.expenditure .commission').text().trim()) : false,
                error: el.hasClass('error') ? el.find('a.error').attr('data-params').text().trim() : false
            };
        }).get();

        return transcations.reverse();
    }
}

module.exports = QiwiMaster;