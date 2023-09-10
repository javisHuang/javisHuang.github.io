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
                return await res.json();
            }
            return null;
        },
        /*
         * 获得钱包代币数量
         * contractAddresses: 多個代币合约地址
         * walletAddress: 钱包地址
         */
        getBatchTokenBalances: async function(web3,contractAddresses, walletAddress) {
            const balances = [];

            const contractPromises = contractAddresses.map(async (contractAddress) => {
                ////创建代币的智能合约函数
                const tokenContract = new web3.eth.Contract(erc20Abi, contractAddress);
                //调用代币的智能合约获取余额功能
                const balance = await tokenContract.methods.balanceOf(walletAddress).call();
                //获得代币有多少位小数
                let decimals = await tokenContract.methods.decimals().call();
                let weiName = this.getWeiName(decimals);
                let tokenBalance = web3.utils.fromWei(balance, weiName);
                //获得代币的符号
                let symbol = await tokenContract.methods.symbol().call();
                balances.push({balance:tokenBalance,symbol:symbol,contract:contractAddress});
            });

            await Promise.all(contractPromises);

            return balances;
        },
        /*
         * 通过小数点多少位，转换对应的数据
         * tokenDecimals: 代币的小数点数
         *
         */
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
        function init(){
            $scope.tokens = tokens;
            $scope.vs_currencies = "TWD";
            $scope.isconnectMetamask = false;
            $scope.currentAccount="";
            $scope.chainList={};
            for (const [key, value] of Object.entries($scope.tokens)) {
                $scope.chainList[value.Main] = {};
                $scope.chainList[value.Main].showTable=false;
                $("#progressBar"+key).width("0%");
            }
        }
        init();
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
            var accounts = await new Web3(ethereum).eth.getAccounts();
            if (accounts && accounts.length > 0) {
                console.log("user is connected");
            } else {
                console.log("user not connected");
                return;
            }
            // 取第一个账户
            $scope.currentAccount = accounts[0];
            $scope.isconnectMetamask = true;
            var asset_platforms = await fetch(`https://api.coingecko.com/api/v3/asset_platforms`);
            $scope.asset_platforms_json = await asset_platforms.json();
            $scope.$apply(async function() {
                for (const [key, value] of Object.entries($scope.tokens)) {
                    await eth($scope.tokens[key].Network);
                }
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
                init();
                dialogService.showAlert('登出MetaMask連接');
            })
        }
        $scope.cardClick = function(token){
            for (const [key, value] of Object.entries($scope.tokens)) {
                $scope.chainList[value.Main].showTable=false
            }
            $scope.chainList[token.Main].showTable=true;
        }
        async function eth(network){
            if(network === undefined){
                return;
            }
            async function getbalance(web3,asset_platforms_id,chainId,currentAccount,vs_currencies){
                // 返回指定地址账户的余额
                var mainbalance = await web3.eth.getBalance(currentAccount);
                var etherBalance = web3.utils.fromWei(mainbalance, 'ether');
                console.log(etherBalance, 2);
                let tokensBalance = await web3Tools.getBatchTokenBalances(web3,$scope.tokens[chainId].subTokens, currentAccount);
                var main = $scope.tokens[chainId];
                var coins = {};
                var total = 0;
                var t = Object.entries(tokensBalance);
                var add = 100/t.length+1
                $("#progressBar"+chainId).width("0%");
                var progress = 0;
                coins[main] = {};
                coins[main].name = main.Coin;
                coins[main].balance = etherBalance;
                coins[main].value = await web3Tools.getCoinID(main.CoinID,vs_currencies);
                total+=coins[main].balance*coins[main].value;
                progress+=add;
                $("#progressBar"+chainId).width(progress+"%");
                var contracts=[];
                for (const [key, value] of t) {
                    contracts.push(value.contract);
                }
                var contractsPrice = await web3Tools.getContractAddresses(asset_platforms_id,contracts.join(),vs_currencies);
                for (const [key, value] of t) {
                    coins[value.symbol] = {};
                    coins[value.symbol].name = value.symbol;
                    coins[value.symbol].balance = value.balance;
                    var price=0;
                    var taddr = contractsPrice[value.contract.toLowerCase()];
                    if (taddr) {
                        var tmpprice = taddr[vs_currencies.toLowerCase()];
                        if(tmpprice){
                            price = tmpprice;
                        }
                    }
                    coins[value.symbol].value = price;
                    total+=coins[value.symbol].balance*coins[value.symbol].value;
                    progress+=add;
                    $("#progressBar"+chainId).width(progress+"%");
                }

                $scope.$apply(() => {
                    $scope.chainList[$scope.tokens[chainId].Main].coinTotalBalance = total;
                    $scope.chainList[$scope.tokens[chainId].Main].coinList = coins;
                })
            }
            var web3 = new Web3(network);
            var chainId = Number(await web3.eth.getChainId());
            var asset_platforms_id = $scope.asset_platforms_json.find(x => x.chain_identifier === chainId).id;
            await getbalance(web3,asset_platforms_id,chainId,$scope.currentAccount,$scope.vs_currencies);
        }
    } )