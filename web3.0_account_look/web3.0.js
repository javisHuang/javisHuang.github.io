var app = angular.module("app", ['dialogService'])
app.factory('web3Tools',function(){
    return {
        getCoinID:async function (ids,vs_currencies){
            var handleError = function (err) {
                console.warn(err);
                return new Response(JSON.stringify({
                    code: 400,
                    message: 'Stupid network Error'
                }));
            };
            const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=${vs_currencies}`).catch(handleError);
            if (res.ok) {
                const token_price = await res.json();
                var tids = token_price[ids];
                if (tids) {
                    var price = tids[vs_currencies.toLowerCase()];
                    if(price){
                        return price;
                    }
                }
            }
            return 0;
        },
        getContractAddresses:async function(id,contract_addresses,vs_currencies){
            contract_addresses = contract_addresses.toLowerCase();
            var handleError = function (err) {
                console.warn(err);
                return new Response(JSON.stringify({
                    code: 400,
                    message: 'Stupid network Error'
                }));
            };
            const res = await fetch(`https://api.coingecko.com/api/v3/simple/token_price/${id}?contract_addresses=${contract_addresses}&vs_currencies=${vs_currencies}`).catch(handleError);
            if (res.ok) {
                const token_price = await res.json();
                var taddr = token_price[contract_addresses];
                if (taddr) {
                    var price = taddr[vs_currencies.toLowerCase()];
                    if(price){
                        return price;
                    }
                }
            }
            return 0;
        },

        /**
         * 获得钱包代币数量
         * tokenAddress: 代币合约地址
         * address: 钱包地址
         **/
        getTokenBalance : async function(tokenAddress, address) {
            ////创建代币的智能合约函数
            let tokenContract = new web3.eth.Contract(erc20Abi, tokenAddress);
            //调用代币的智能合约获取余额功能
            let result = await tokenContract.methods.balanceOf(address).call();
            //获得代币有多少位小数
            let decimals = await tokenContract.methods.decimals().call();
            let weiName = this.getWeiName(decimals);
            let tokenBalance = web3.utils.fromWei(result, weiName);
            //获得代币的符号
            let symbol = await tokenContract.methods.symbol().call();
            return {balance:tokenBalance,symbol:symbol};
        },
        /**
         * 通过小数点多少位，转换对应的数据
         * tokenDecimals: 代币的小数点数
         *
         **/
        getWeiName:function(tokenDecimals = 18) {
            tokenDecimals = Number(tokenDecimals);
            let weiName = 'ether';
            switch (tokenDecimals) {
                case 3:
                    weiName = "Kwei";
                    break;
                case 6:
                    weiName = 'mwei';
                    break;
                case 9:
                    weiName = 'gwei';
                    break;
                case 12:
                    weiName = 'microether ';
                    break;
                case 15:
                    weiName = 'milliether';
                    break;
                case 18:
                    weiName = 'ether';
                    break;
                default:
                    weiName = 'ether';
                    break;

            }
            return weiName;
        }
    }
})
app.controller("Web3Ctrl", function($scope,dialogService,web3Tools) {
        $scope.vs_currencies = "TWD";
        $scope.isconnectMetamask = false;
        $scope.currentAccount="";
        // 实例化web3
        window.web3 = new Web3(ethereum);
        var web3 = window.web3;
        $scope.connectMetamask = async function(){
            if (typeof window.ethereum !== 'undefined') {
                console.log('MetaMask is installed!');
            }else{
                dialogService.showAlert('MetaMask未安裝');
                return;
            }
            // 请求用户授权 解决web3js无法直接唤起Meta Mask获取用户身份
            const enable = await ethereum.enable();
            console.log(enable,11);
            // 授权获取账户
            var accounts = await web3.eth.getAccounts();
            if (accounts && accounts.length > 0) {
                console.log("user is connected");
            } else {
                console.log("user not connected");
                return;
            }
            var chainId = Number(await web3.eth.getChainId());
            var asset_platforms = await fetch(`https://api.coingecko.com/api/v3/asset_platforms`);
            const asset_platforms_json = await asset_platforms.json();
            var asset_platforms_id = asset_platforms_json.find(x => x.chain_identifier === chainId).id;
            $scope.$apply(() => {
                // 取第一个账户
                $scope.currentAccount = accounts[0];
                console.log($scope.currentAccount, 1);
                $scope.isconnectMetamask = true;
                $scope.tokenMain = tokens[chainId].Main;
                getbalance(asset_platforms_id,chainId,$scope.currentAccount,$scope.vs_currencies);
            })
        }
        $scope.disconnectMetamask = async function(){
            if (typeof window.ethereum === 'undefined') {
                return;
            }
            if (!ethereum.isConnected()) {
                return;
            }
            await window.ethereum.request({
                method: "eth_requestAccounts",
                params: [{eth_accounts: {}}]
            })
            $scope.$apply(() => {
                delete $scope.currentAccount;
                delete $scope.isconnectMetamask;
                delete $scope.coinList;
                delete $scope.coinTotalBalance;
                $("#progressBar").width("0%");
                $("#progressBar").parent().parent().show();
                dialogService.showAlert('登出MetaMask連接');
            })
        }
        async function getbalance(asset_platforms_id,chainId,currentAccount,vs_currencies){
            // 返回指定地址账户的余额
            var mainbalance = await web3.eth.getBalance(currentAccount);
            var etherBalance = web3.utils.fromWei(mainbalance, 'ether');
            console.log(etherBalance, 2);

            var tokensBalance=[];
            for (let subToken of tokens[chainId].subTokens) {
                let balance = await web3Tools.getTokenBalance(subToken, currentAccount);
                balance.contract = subToken;
                tokensBalance.push(balance);
            }

            $("#progressBar").parent().parent().show();
            $("#progressBar").width("0%");
            var main = tokens[chainId];
            var coins = {};
            var total = 0;
            var t = Object.entries(tokensBalance);
            var add = 100/t.length+1;
            var progress = 0;
            coins[main] = {};
            coins[main].name = main.Coin;
            coins[main].balance = etherBalance;
            coins[main].value = await web3Tools.getCoinID(main.CoinID,vs_currencies);
            total+=coins[main].balance*coins[main].value;
            progress+=add;
            $("#progressBar").width(progress+"%");
            for (const [key, value] of t) {
                coins[value.symbol] = {};
                coins[value.symbol].name = value.symbol;
                coins[value.symbol].balance = value.balance;
                coins[value.symbol].value = await web3Tools.getContractAddresses(asset_platforms_id,value.contract,vs_currencies);
                total+=coins[value.symbol].balance*coins[value.symbol].value;
                progress+=add;
                $("#progressBar").width(progress+"%");
            }

            $scope.$apply(() => {
                $("#progressBar").parent().parent().hide();
                $scope.coinTotalBalance = total;
                $scope.coinList = coins;
            })
        }
    } )