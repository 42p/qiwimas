
const QiwiMaster = require('./QiwiMaster');

class CheckingBalance {

    constructor(qiwiAuth) {
        this.intervalCheckBalance = 30;
        this.qiwiMaster = new QiwiMaster(qiwiAuth);
        this.balance = 0;
        this.updateBalanceEnabled = true;
        this.workUpdaterBalance = false;
    }

    /**
     * Update balance by timeout
     * @param cb(err, amount, isChanged)
     */
    updaterBalance(cb) {
        var updaterBalance = setInterval(() => {

            this.workUpdaterBalance = true;

            if (!this.updateBalanceEnabled) {
                this.workUpdaterBalance = false;
                clearInterval(updaterBalance);
            }

            var gettingBalance = () => {
                return this.qiwiMaster.getBalance().then(amount => {
                    if (this.balance != amount) {
                        this.balance = amount;

                        cb(null, this.balance, true);
                    } else {
                        cb(null, this.balance);
                    }
                }).catch(err => cb(err));
            };

            this.qiwiMaster.checkAuth().then(() => {
                return gettingBalance();
            }).catch(err => {
                return this.qiwiMaster.login().then(() => {
                    return gettingBalance();
                });
            }).catch(err => {
                cb(err);
            });

        }, this.intervalCheckBalance * 1000);
    }

    updaterBalanceDisable() {
        this.updateBalanceEnabled = false;
    }


}

module.exports = CheckingBalance;