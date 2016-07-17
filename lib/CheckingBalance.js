
const QiwiMaster = require('./QiwiMaster'),
      mysql = require('mysql2/promise');

class CheckingBalance {

    constructor(config) {

        if (!Object.keys(config.qiwi).length) {
            throw new Error('Not filled qiwi data');
        }

        this.config = config;
        this.intervalCheckBalance = 30;
        this.qiwiMaster = new QiwiMaster(config.qiwi);
        this.balance = 0;
        this.updateBalanceEnabled = true;
        this.workUpdaterBalance = false;
        this.db = null;
        this.dbConnection = null;
        this.updateTransactionLevel = 10;
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

        var intervalWorkUpdaterBalance = setInterval(() => {
            if (!this.workUpdaterBalance && this.dbConnection) {
                this.dbConnection.end();

                clearInterval(intervalWorkUpdaterBalance);
            }
        }, 1000);
    }

    closeDbConnection() {
        if (this.dbConnection) this.dbConnection.end();
    }

    updaterTransactions() {
        return this.qiwiMaster.getHistoryWeek().then(transactions => {

            if (!transactions.length) return;

            return this.getDbConnection().then((conn) => {
                this.dbConnection = conn;

                var countAdded = 0;

                return conn.query('SELECT * FROM qiwi_transactions ORDER BY id DESC LIMIT 1').then(results => {

                    if (!results[0].length && !transactions.length) {
                        return countAdded;
                    }

                    if (results[0].length) {
                        var lastTransactionId = results[0][0].qiwi_id;
                        var indexNewTransaction = null;

                        transactions.forEach((item, index) => {
                            if (item.transaction == lastTransactionId) {
                                indexNewTransaction = ++index;
                            }
                        });
                    } else {
                        var indexNewTransaction = 0;
                    }

                    if (indexNewTransaction !== null) {
                        let newTransactions = transactions.slice(indexNewTransaction);

                        var addingTransactions = newTransactions.map((trans, index) => {
                            return new Promise((resolve, reject) => {
                                if (trans.status && !trans.expenditure) {

                                    let curdate = new Date();
                                    let [dateSplit, timeSplit] = [trans.date.split('.'), trans.time.split(':')];

                                    let qDate        = `${dateSplit[2]}-${dateSplit[1]}-${dateSplit[0]} ${timeSplit[0]}:${timeSplit[1]}:00`;
                                    let created_at   = `${curdate.getFullYear()}-${curdate.getMonth()+1}-${curdate.getDate()} ${curdate.getHours()}:${curdate.getMinutes()}:${curdate.getSeconds()}`;

                                    this.addTransaction({
                                        qiwi_id: trans.transaction,
                                        provider: trans.provider,
                                        comment: trans.comment,
                                        amount: trans.amount,
                                        type: 1,
                                        qiwi_date: qDate,
                                        created_at: created_at,
                                        updated_at: created_at
                                    }).then(results => {

                                        countAdded++;
                                        resolve();

                                    }).catch(reject);

                                } else {
                                    resolve();
                                }
                            })
                        });

                        return Promise.all(addingTransactions).then(() => countAdded);

                    } else {
                        return 0;
                    }
                }).catch(err => {
                    if (err.code == 'EPIPE') {
                        console.log('Mysql disconnect. Reconnect...');

                        return this.createMysqlConnection();
                    } else {
                        return err;
                    }
                });

            });
        });
    }

    checkExistsTransaction(transactionId) {
        return this.getDbConnection().then((conn) => {
            return conn.execute('SELECT COUNT(*) AS count FROM qiwi_transactions WHERE qiwi_id=?', [transactionId]);
        }).then(results => {
            return results[0][0].count > 0;
        });
    }

    addTransaction(data) {
        return this.getDbConnection().then(conn => {
           return conn.query('INSERT INTO qiwi_transactions SET ?', data);
        });
    }

    removeTransaction(transactionId) {
        return this.getDbConnection().then(conn => {
            return conn.execute('DELETE FROM qiwi_transactions WHERE qiwi_id=?', [transactionId]);
        });
    }

    removeAllTransactions() {
        return this.getDbConnection().then(conn => {
            return conn.execute("TRUNCATE TABLE qiwi_transactions");
        });
    }

    getDbConnection() {
        return this.db ? this.db : this.createMysqlConnection();
    }

    createMysqlConnection() {
        this.db = mysql.createConnection(this.config.database);

        return this.db;
    }
}

module.exports = CheckingBalance;