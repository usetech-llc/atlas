/*

 ALLOCATE ACX
 throw error if called by unauthorized address
 update ACX allocations for proper address and ACX_balance of IP
 if called by Governance account
 if called by DM account
 (MINT ACX tests)

 ALLOCATE ETH
 (same as ACX)

 CLAIM ACX
 don't send funds if called by address with 0 allocation
 send funds and update ACX allocations to 0 if called by address with non-zero allocation
 don't send funds if called again after allocations are claimed

 CLAIM ETH
 (same as ACX)

 MINT ACX
 update ACX_balance & ACX_minted for all cases
 a. last update and now are in deterministic period
 b. last update is in deterministic period, now is dynamic period
 i) inflation = 0
 ii) inflation = 1
 iii) inflation = 0.5
 c. last update and now are in dynamic period
 i) inflation = 0
 ii) inflation = 1
 iii) inflation = 0.5
 UNLOCK ETH
 update ETH_balance & ETH_unlocked for all cases
 a. now is in unlocking period
 b. last_update is in unlocking period, now is past it


 INFLATION RATE
 update inflation rate and account's inflation switch
 for -> against
 against -> for

 */

const BigNumber = web3.BigNumber;
BigNumber.config({ DECIMAL_PLACES: 18, ROUNDING_MODE: BigNumber.ROUND_DOWN });

require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(BigNumber))
    .should();
const timeHelper = require('./helpers/timeHelper');
const ethereumAsserts = require('./helpers/ethereumAsserts');
const expectRevertAsync = ethereumAsserts.expectRevertAsync;

contract('IncentivePool', function (accounts) {
    const IncentivePool = artifacts.require('./../contracts/IncentivePoolStub.sol');
    const Relay = artifacts.require('./../contracts/Relay.sol');
    const AccessToken = artifacts.require('./../contracts/AccessToken.sol');
    const IncentivePoolParams = (_relayAddress, _tokenAddress) => {
        return Object.values({
            _relayAddress: _relayAddress,
            _tokenAddress: _tokenAddress
        });
    };
    const RelayConstructorParams = (_governanceAddr) => {
        return Object.values({
            initial_governance: _governanceAddr
        });
    };

    let sut;                // IncentivePool contract instance
    let relay;              // Relay contract instance
    let token;              // AccessToken contract instance
    let preDeploymentTime;
    let pastDeploymentTime;
    let genesis;            // sut genesis time
    let governanceAddr = accounts[1];
    let decisionModuleAddr = accounts[2];
    let recipient1 = accounts[3];
    let recipient2 = accounts[4];
    let tokenMultiplier;
    let ethCap = web3.toWei(6000, 'ether');

    const secondsInOneYear = 31557600;

    /**
     *  Send funds to user (by allocate + claim)
     *  @amount of tokens should be available to allocation
     */
    const allocateAndClaim = async(amount, userAddress) => {
        await sut.allocateACX(amount, userAddress, {from: decisionModuleAddr});
        await sut.claimACX({from: userAddress});
    }

    async function deployContracts() {
        relay = await Relay.new(...RelayConstructorParams(governanceAddr), {gas: 10000000});
        await relay.setDecisionModule(decisionModuleAddr, {from: governanceAddr});
        token = await AccessToken.new({gas: 10000000});

        preDeploymentTime = timeHelper.getCurrentTime();
        sut = await IncentivePool.new(...IncentivePoolParams(relay.address, token.address), {gas: 10000000});
        pastDeploymentTime = timeHelper.getCurrentTime();
        genesis = web3.toBigNumber(await sut.genesis());
        var tokenDecimals = web3.toBigNumber(await token.decimals());
        tokenMultiplier = new BigNumber(Math.pow(10, tokenDecimals));

        // Configure token to work with Incentive Pool
        await token.setMinter(sut.address);
        await token.setIncentivePool(sut.address);
    }

    before(async function () {
        await deployContracts();
    });

    describe('Incentive Pool Deployment', async() => {
        it('Deployment should fail if Relay address is zero', async () => {
            await expectRevertAsync(async () => {
                await IncentivePool.new(...IncentivePoolParams(0x0), {gas: 10000000});
            });
        });

        it('Genesis time is between pre-deployment and past-deployment time', async () => {
            genesis.should.be.bignumber.at.least(preDeploymentTime);
            genesis.should.be.bignumber.at.most(pastDeploymentTime);
        });

        it('Last ETH update timestamp matches genesis timestamp', async () => {
            var last_ETH_update = web3.toBigNumber(await sut.last_ETH_update());
            last_ETH_update.should.be.bignumber.equal(genesis);
        });

        it('Relay address', async () => {
            var realyAddress = await sut.relay();
            realyAddress.should.equal(relay.address);
        });

        it('Initial values and balances', async () => {
            var ACX_minted = web3.toBigNumber(await sut.ACX_minted());
            var ACX_balance = web3.toBigNumber(await sut.ACX_balance());
            var ETH_unlocked = web3.toBigNumber(await sut.ETH_unlocked());
            var ETH_balance = web3.toBigNumber(await sut.ETH_balance());
            var inflation_rate = web3.toBigNumber(await sut.getCurrentInflation());
            var inflation_support = web3.toBigNumber(await sut.inflation_support());
            ACX_minted.should.be.bignumber.equal(0);
            ACX_balance.should.be.bignumber.equal(0);
            ETH_unlocked.should.be.bignumber.equal(0);
            ETH_balance.should.be.bignumber.equal(0);
            inflation_rate.should.be.bignumber.equal(0);
            inflation_support.should.be.bignumber.equal(0);
        });
    })

    describe('Allocate ACX', async() => {
        describe('ACX deterministic curve', async() => {
            it('Equals 0 at genesis time', async () => {
                var curveVal = web3.toBigNumber(await sut.getCurveValueTestable(genesis));
                curveVal.should.be.bignumber.equal(0);
            });

            it('Equals 1.62 billion 10+ years after genesis time', async () => {
                var secondsIn10Years = 365.25 * 24 * 60 * 60 * 10 + 1;
                var curveVal = web3.toBigNumber(await sut.getCurveValueTestable(genesis.add(secondsIn10Years)));
                curveVal.should.be.bignumber.equal(1.62e9 * tokenMultiplier);
            });

            it('1 second value is within 10%', async () => {
                var seconds = 1;
                var curveVal = web3.toBigNumber(await sut.getCurveValueTestable(genesis.add(seconds)));
                var expectedVal = 30.88 * tokenMultiplier;
                var errorVal = Math.abs(expectedVal - curveVal) / expectedVal;
                errorVal.should.be.lessThan(0.1);
            });

            it('10 second value is within 5%', async () => {
                var seconds = 10;
                var curveVal = web3.toBigNumber(await sut.getCurveValueTestable(genesis.add(seconds)));
                var expectedVal = 308.8 * tokenMultiplier;
                var errorVal = Math.abs(expectedVal - curveVal) / expectedVal;
                errorVal.should.be.lessThan(0.05);
            });

            it('18 day value is within 2%', async () => {
                var seconds = 18 * 24 * 60 * 60;
                var curveVal = web3.toBigNumber(await sut.getCurveValueTestable(genesis.add(seconds)));
                var expectedVal = 47320471.0682206 * tokenMultiplier;
                var errorVal = Math.abs(expectedVal - curveVal) / expectedVal;
                errorVal.should.be.lessThan(0.02);
            });

            it('30 day value is within 1%', async () => {
                var seconds = 30 * 24 * 60 * 60;
                var curveVal = web3.toBigNumber(await sut.getCurveValueTestable(genesis.add(seconds)));
                var expectedVal = 78097024.379052 * tokenMultiplier;
                var errorVal = Math.abs(expectedVal - curveVal) / expectedVal;
                errorVal.should.be.lessThan(0.01);
            });

            it('60 day value is within 0.5%', async () => {
                var seconds = 60 * 24 * 60 * 60;
                var curveVal = web3.toBigNumber(await sut.getCurveValueTestable(genesis.add(seconds)));
                var expectedVal = 152429144.303251 * tokenMultiplier;
                var errorVal = Math.abs(expectedVal - curveVal) / expectedVal;
                errorVal.should.be.lessThan(0.005);
            });

            it('180 day value is within 0.1%', async () => {
                var seconds = 180 * 24 * 60 * 60;
                var curveVal = web3.toBigNumber(await sut.getCurveValueTestable(genesis.add(seconds)));
                var expectedVal = 415609817.800646 * tokenMultiplier;
                var errorVal = Math.abs(expectedVal - curveVal) / expectedVal;
                errorVal.should.be.lessThan(0.001);
            });

            it('1 year value is within 0.01%', async () => {
                var seconds = 1 * 365.25 * 24 * 60 * 60;
                var curveVal = web3.toBigNumber(await sut.getCurveValueTestable(genesis.add(seconds)));
                var expectedVal = 732304018 * tokenMultiplier;
                var errorVal = Math.abs(expectedVal - curveVal) / expectedVal;
                errorVal.should.be.lessThan(0.0001);
            });

            it('383 day value is within 0.1%', async () => {
                var seconds = 383 * 24 * 60 * 60;
                var curveVal = web3.toBigNumber(await sut.getCurveValueTestable(genesis.add(seconds)));
                var expectedVal = 757878869.133486 * tokenMultiplier;
                var errorVal = Math.abs(expectedVal - curveVal) / expectedVal;
                errorVal.should.be.lessThan(0.001);
            });

            it('2 year value is within 0.01%', async () => {
                var seconds = 2 * 365.25 * 24 * 60 * 60;
                var curveVal = web3.toBigNumber(await sut.getCurveValueTestable(genesis.add(seconds)));
                var expectedVal = 1133577681 * tokenMultiplier;
                var errorVal = Math.abs(expectedVal - curveVal) / expectedVal;
                errorVal.should.be.lessThan(0.0001);
            });

            it('3 year value is within 0.01%', async () => {
                var seconds = 3 * 365.25 * 24 * 60 * 60;
                var curveVal = web3.toBigNumber(await sut.getCurveValueTestable(genesis.add(seconds)));
                var expectedVal = 1353459791 * tokenMultiplier;
                var errorVal = Math.abs(expectedVal - curveVal) / expectedVal;
                errorVal.should.be.lessThan(0.0001);
            });

            it('4 year value is within 0.01%', async () => {
                var seconds = 4 * 365.25 * 24 * 60 * 60;
                var curveVal = web3.toBigNumber(await sut.getCurveValueTestable(genesis.add(seconds)));
                var expectedVal = 1473946498.37447 * tokenMultiplier;
                var errorVal = Math.abs(expectedVal - curveVal) / expectedVal;
                errorVal.should.be.lessThan(0.0001);
            });

            it('5 year value is within 0.01%', async () => {
                var seconds = 5 * 365.25 * 24 * 60 * 60;
                var curveVal = web3.toBigNumber(await sut.getCurveValueTestable(genesis.add(seconds)));
                var expectedVal = 1539968452.71267 * tokenMultiplier;
                var errorVal = Math.abs(expectedVal - curveVal) / expectedVal;
                errorVal.should.be.lessThan(0.0001);
            });

            it('6 year value is within 0.01%', async () => {
                var seconds = 6 * 365.25 * 24 * 60 * 60;
                var curveVal = web3.toBigNumber(await sut.getCurveValueTestable(genesis.add(seconds)));
                var expectedVal = 1576145874.69717 * tokenMultiplier;
                var errorVal = Math.abs(expectedVal - curveVal) / expectedVal;
                errorVal.should.be.lessThan(0.0001);
            });

            it('7 year value is within 0.01%', async () => {
                var seconds = 7 * 365.25 * 24 * 60 * 60;
                var curveVal = web3.toBigNumber(await sut.getCurveValueTestable(genesis.add(seconds)));
                var expectedVal = 1595969672.31969 * tokenMultiplier;
                var errorVal = Math.abs(expectedVal - curveVal) / expectedVal;
                errorVal.should.be.lessThan(0.0001);
            });

            it('8 year value is within 0.01%', async () => {
                var seconds = 8 * 365.25 * 24 * 60 * 60;
                var curveVal = web3.toBigNumber(await sut.getCurveValueTestable(genesis.add(seconds)));
                var expectedVal = 1606832330.03884 * tokenMultiplier;
                var errorVal = Math.abs(expectedVal - curveVal) / expectedVal;
                errorVal.should.be.lessThan(0.0001);
            });

            it('9 year value is within 0.01%', async () => {
                var seconds = 9 * 365.25 * 24 * 60 * 60;
                var curveVal = web3.toBigNumber(await sut.getCurveValueTestable(genesis.add(seconds)));
                var expectedVal = 1612784637.20875 * tokenMultiplier;
                var errorVal = Math.abs(expectedVal - curveVal) / expectedVal;
                errorVal.should.be.lessThan(0.0001);
            });

            it('Curve is uniformly increasing', async () => {
                var secondsIn10Years = 365.25 * 24 * 60 * 60 * 10;
                var iterations = 1000;
                var step = parseInt(secondsIn10Years/iterations);
                var prevValue = 0;
                for (var seconds=step; seconds<secondsIn10Years; seconds+=step) {
                    var curveVal = web3.toBigNumber(await sut.getCurveValueTestable(genesis.add(seconds)));
                    prevValue.should.be.bignumber.lessThan(curveVal);
                    prevValue = curveVal;
                }
            });
        })

        describe('allocateACX Method security', async() => {
            it('Should be callable by Decision Module', async () => {
                await sut.allocateACX(0, recipient1, {from: decisionModuleAddr}).should.be.fulfilled;
            });

            it('Should be callable by Governance', async () => {
                await sut.allocateACX(0, recipient1, {from: governanceAddr}).should.be.fulfilled;
            });

            it('Should not be callable from non-controller address', async () => {
                await sut.allocateACX(0, recipient1, {from: recipient1}).should.be.rejected;
            });
        })

        describe('allocateACX Method logic', async() => {
            beforeEach(async function () {
                await deployContracts();

                // Adjust time to 30 days after deployment
                await timeHelper.setTestRPCTime(genesis.add(30 * 24 * 3600));
            });

            it('Should not allocate above available ACX balance', async () => {
                var badAmount = tokenMultiplier.mul(78097024 * 1.1);
                await sut.allocateACX(badAmount, recipient1, {from: decisionModuleAddr}).should.be.rejected;
            });

            it('Should mint and increase ACX_balance to match curve within deterministic inflation', async () => {
                var amount = 0;

                // Get curve value for 30 days
                var seconds = 30 * 24 * 60 * 60;
                var curveVal = web3.toBigNumber(await sut.getCurveValueTestable(genesis.add(seconds)));
                var curveValUpper = web3.toBigNumber(await sut.getCurveValueTestable(genesis.add(seconds + 10)));

                // Call ACX Allocate and measure minted balance
                var ACX_balanceBefore = web3.toBigNumber(await sut.ACX_balance());
                var ACX_mintedBefore = web3.toBigNumber(await sut.ACX_minted());
                await sut.allocateACX(amount, recipient1, {from: decisionModuleAddr}).should.be.fulfilled;
                var ACX_balanceAfter = web3.toBigNumber(await sut.ACX_balance());
                var ACX_mintedAfter = web3.toBigNumber(await sut.ACX_minted());

                ACX_balanceBefore.should.be.bignumber.equal(0);
                ACX_mintedBefore.should.be.bignumber.equal(0);

                // Time may have updated by a few seconds, so this equality is only approximate
                ACX_balanceAfter.should.be.bignumber.at.least(curveVal);
                ACX_balanceAfter.should.be.bignumber.at.most(curveValUpper);

                ACX_mintedAfter.should.be.bignumber.at.least(curveVal);
                ACX_mintedAfter.should.be.bignumber.at.most(curveValUpper);
            });

            it('Should increase ACX_allocations by requested amount', async () => {
                var amount = tokenMultiplier.mul(70000000);

                // Call ACX Allocate and measure minted balance
                var ACX_allocationsBefore = web3.toBigNumber(await sut.ACX_allocations(recipient1));
                await sut.allocateACX(amount, recipient1, {from: decisionModuleAddr}).should.be.fulfilled;
                var ACX_allocationsAfter = web3.toBigNumber(await sut.ACX_allocations(recipient1));

                ACX_allocationsBefore.should.be.bignumber.equal(0);
                ACX_allocationsAfter.should.be.bignumber.equal(amount);
            });

            it('Should decrease ACX_balance by requested amount', async () => {
                var zeroAmount = 0;
                var amount = tokenMultiplier.mul(70000000);

                // Get curve value for 30 days
                var seconds = 30 * 24 * 60 * 60;
                var curveValBefore = web3.toBigNumber(await sut.getCurveValueTestable(genesis.add(seconds)));
                var curveValAfter = web3.toBigNumber(await sut.getCurveValueTestable(genesis.add(seconds + 10)));
                var tolerance = curveValAfter.minus(curveValBefore);

                // Call ACX Allocate with 0 amount to trigger mint
                await sut.allocateACX(zeroAmount, recipient1, {from: decisionModuleAddr}).should.be.fulfilled;

                // Call ACX Allocate and measure decrease in balance
                var ACX_balanceBefore = web3.toBigNumber(await sut.ACX_balance());
                await sut.allocateACX(amount, recipient1, {from: decisionModuleAddr}).should.be.fulfilled;
                var ACX_balanceAfter = web3.toBigNumber(await sut.ACX_balance());

                // Time may have updated by a few seconds, so this equality is only approximate
                ACX_balanceBefore.sub(amount).should.be.bignumber.at.least(ACX_balanceAfter);
                ACX_balanceBefore.sub(amount).should.be.bignumber.at.most(ACX_balanceAfter.add(tolerance));
            });

            it('Should mint tokens according to ACX_minted', async () => {
                var amount = 0;

                // Call ACX Allocate and measure minted balance
                await sut.allocateACX(amount, recipient1, {from: decisionModuleAddr}).should.be.fulfilled;
                var ACX_minted = web3.toBigNumber(await sut.ACX_minted());

                // Get token balance on the contract
                var contractTokenBalance = web3.toBigNumber(await token.balanceOf(sut.address));

                contractTokenBalance.should.be.bignumber.equal(ACX_minted);
            });

            it('Two sequential mints should mint tokens according to ACX_minted', async () => {
                var amount = 0;

                // Call ACX Allocate
                await sut.allocateACX(amount, recipient1, {from: decisionModuleAddr}).should.be.fulfilled;

                // Adjust time to 60 days after deployment
                await timeHelper.setTestRPCTime(genesis.add(60 * 24 * 3600));

                // Call ACX Allocate again and measure minted balance
                await sut.allocateACX(amount, recipient1, {from: decisionModuleAddr}).should.be.fulfilled;
                var ACX_minted = web3.toBigNumber(await sut.ACX_minted());

                // Get token balance on the contract
                var contractTokenBalance = web3.toBigNumber(await token.balanceOf(sut.address));

                contractTokenBalance.should.be.bignumber.equal(ACX_minted);
            });
        })
    })

    describe('Inflation voting', async() => {
        beforeEach(async function () {
            await deployContracts();
        });

        it('inflation_support and inflation_votes are initialized to 0', async() => {
            (await sut.inflation_support()).should.be.bignumber.equal(new BigNumber(0));
            (await sut.inflation_votes(recipient1)).should.be.bignumber.equal(new BigNumber(0));
        })

        it('user votes for inflation', async() => {
            await timeHelper.setTestRPCTime(genesis.add(30 * 24 * 3600));
            var amount = tokenMultiplier.mul(70);
            await allocateAndClaim(amount, recipient1);
            await sut.inflationSwitch({from: recipient1});

            (await sut.inflation_support()).should.be.bignumber.equal(amount);
            (await sut.inflation_votes(recipient1)).should.be.bignumber.equal(amount);
        })

        it('user flips vote against inflation', async() => {
            await timeHelper.setTestRPCTime(genesis.add(30 * 24 * 3600));
            var amount = tokenMultiplier.mul(70);
            await allocateAndClaim(amount, recipient1);
            await sut.inflationSwitch({from: recipient1});
            await sut.inflationSwitch({from: recipient1});

            (await sut.inflation_support()).should.be.bignumber.equal(new BigNumber(0));
            (await sut.inflation_votes(recipient1)).should.be.bignumber.equal(new BigNumber(0));
        })

        it('Token transfer resets vote (transfer)', async() => {
            await timeHelper.setTestRPCTime(genesis.add(30 * 24 * 3600));
            var amount = tokenMultiplier.mul(70);
            await allocateAndClaim(amount, recipient1);
            await sut.inflationSwitch({from: recipient1});

            await token.transfer(recipient2, amount, {from: recipient1});
            var voteAfter = web3.toBigNumber(await sut.inflation_votes(recipient1));

            (await sut.inflation_support()).should.be.bignumber.equal(new BigNumber(0));
            voteAfter.should.be.bignumber.equal(0);
        })

        it('Token transfer resets vote (transferFrom)', async() => {
            await timeHelper.setTestRPCTime(genesis.add(30 * 24 * 3600));
            var amount = tokenMultiplier.mul(70);
            await allocateAndClaim(amount, recipient1);
            await sut.inflationSwitch({from: recipient1});

            await token.approve(accounts[0], amount, {from: recipient1});
            await token.transferFrom(recipient1, recipient2, amount, {from: accounts[0]});
            var voteAfter = web3.toBigNumber(await sut.inflation_votes(recipient1));

            (await sut.inflation_support()).should.be.bignumber.equal(new BigNumber(0));
            voteAfter.should.be.bignumber.equal(0);
        })

        it('Random address cannot reset vote', async() => {
            await timeHelper.setTestRPCTime(genesis.add(30 * 24 * 3600));
            expectRevertAsync(async() => {
                await sut.resetInflationVote(recipient1, {from: recipient1});
            })
        })

        it('several users vote', async() => {
            await timeHelper.setTestRPCTime(genesis.add(30 * 24 * 3600));
            var amount1 = tokenMultiplier.mul(10);
            var amount2 = tokenMultiplier.mul(20);
            await allocateAndClaim(amount1, recipient1);
            await allocateAndClaim(amount2, recipient2);
            await sut.inflationSwitch({from: recipient1});
            await sut.inflationSwitch({from: recipient2});

            (await sut.inflation_support()).should.be.bignumber.equal(amount1.plus(amount2));
            (await sut.inflation_votes(recipient1)).should.be.bignumber.equal(amount1);
            (await sut.inflation_votes(recipient2)).should.be.bignumber.equal(amount2);
        })
    })

    describe('Update Inflation cases', async() => {
        beforeEach(async function () {
            await deployContracts();
        });

        it('there is no inflation before first update', async() => {
            (await sut.getCurrentInflation()).should.be.bignumber.equal(new BigNumber(0));
            (await sut.last_inflation_update()).should.be.bignumber.equal(new BigNumber(0));
        })

        it('updateInflation should be rejected before deterministic period end', async() => {
            await timeHelper.setTestRPCTime(genesis);
            await sut.updateInflation({from: decisionModuleAddr}).should.be.rejected;
        })

        it('only controller can update inflation', async() => {
            await timeHelper.setTestRPCTime(genesis.add(10 * 365.25 * 24 * 3600));
            await sut.updateInflation({from: recipient1}).should.be.rejected;
        })

        it('updateInflation cannot be called more than once a year', async () => {
            await timeHelper.setTestRPCTime(genesis.add(10 * 365.25 * 24 * 3600));

            // Call updateInflation first time - expect to fulfil
            await sut.updateInflation({from: decisionModuleAddr}).should.be.fulfilled;

            // Call updateInflation second time - expect to reject
            await sut.updateInflation({from: decisionModuleAddr}).should.be.rejected;
        });

        it('update inflation after 10 years: values are correct', async() => {
            await timeHelper.setTestRPCTime(genesis.add(10 * 365.25 * 24 * 3600));

            var amount = tokenMultiplier.mul(70);
            await allocateAndClaim(amount, recipient1);
            await sut.inflationSwitch({from: recipient1});

            var iTime = await timeHelper.executeAndGetTimestamp(async() => {
                return await sut.updateInflation({from: decisionModuleAddr});
            });

            (await sut.getCurrentInflation()).should.be.bignumber.equal(amount.dividedBy(100));
            (await sut.inflation_rate(0)).should.be.bignumber.equal(amount.dividedBy(100));

            (await sut.inflation_timestamp(0)).should.be.bignumber.equal(iTime);
            (await sut.last_inflation_update()).should.be.bignumber.equal(iTime);
        })

        it('update inflation after 10 and 11 years: values are correct', async() => {

            // 10 years+ after genesis: recipient1 votes for inflation
            await timeHelper.setTestRPCTime(genesis.add(10 * 365.25 * 24 * 3600));
            var amount1 = tokenMultiplier.mul(10);
            await allocateAndClaim(amount1, recipient1);
            await sut.inflationSwitch({from: recipient1});
            const iTime1 = await timeHelper.executeAndGetTimestamp(async() => {
                return await sut.updateInflation({from: decisionModuleAddr});
            });

            // 11 years+ after genesis: recipient2 votes for inflation
            await timeHelper.setTestRPCTime(genesis.add(11 * 365.25 * 24 * 3600 + 10));
            var amount2 = tokenMultiplier.mul(20);
            await allocateAndClaim(amount2, recipient2);
            await sut.inflationSwitch({from: recipient2});
            const iTime2 = await timeHelper.executeAndGetTimestamp(async() => {
                return await sut.updateInflation({from: decisionModuleAddr});
            });

            (await sut.getCurrentInflation()).should.be.bignumber.equal(amount1.plus(amount2).dividedBy(100));
            (await sut.inflation_rate(0)).should.be.bignumber.equal(amount1.dividedBy(100));
            (await sut.inflation_rate(1)).should.be.bignumber.equal(amount1.plus(amount2).dividedBy(100));
            (await sut.inflation_timestamp(0)).should.be.bignumber.equal(iTime1);
            (await sut.inflation_timestamp(1)).should.be.bignumber.equal(iTime2);
            (await sut.last_inflation_update()).should.be.bignumber.equal(iTime2);
        })
    })

    describe('ACX Inflation', async() => {

        let baseAcxAmount;

        beforeEach(async function () {
            await deployContracts();
            baseAcxAmount = new BigNumber(1.62e9).mul(tokenMultiplier);
        });

        /* 3 cases:
         a. last update and now are in deterministic period
         b. last update is in deterministic period, now is dynamic period
         c. last update and now are in dynamic period
         */

        it('base amount should be exactly 1.62 billion', async () => {
            // Adjust time to 10 years after deployment
            await timeHelper.setTestRPCTime(genesis.add(10 * 365.25 * 24 * 3600));

            await sut.allocateACX(0, recipient1, {from: decisionModuleAddr}).should.be.fulfilled;
            web3.toBigNumber(await sut.ACX_minted()).should.be.bignumber.equal(baseAcxAmount);
        });

        it('inflation should be zero without calling updateInflation', async () => {
            await timeHelper.setTestRPCTime(genesis.add(10 * 365.25 * 24 * 3600));
            await sut.allocateACX(0, recipient1, {from: decisionModuleAddr}).should.be.fulfilled;
            await timeHelper.setTestRPCTime(genesis.add(12 * 365.25 * 24 * 3600));
            (await sut.ACX_minted()).should.be.bignumber.equal(baseAcxAmount);
            await timeHelper.setTestRPCTime(genesis.add(15 * 365.25 * 24 * 3600));
            (await sut.ACX_minted()).should.be.bignumber.equal(baseAcxAmount);
            await timeHelper.setTestRPCTime(genesis.add(20 * 365.25 * 24 * 3600));
            (await sut.ACX_minted()).should.be.bignumber.equal(baseAcxAmount);
        });

        it('minted amount does not change after deterministic period before update inflation', async() => {
            (await sut.getMintedAmountForTimestampTestable(10 * 365.25 * 24 * 3600)).should.be.bignumber.equal(baseAcxAmount);
            (await sut.getMintedAmountForTimestampTestable(12 * 365.25 * 24 * 3600)).should.be.bignumber.equal(baseAcxAmount);
            (await sut.getMintedAmountForTimestampTestable(15 * 365.25 * 24 * 3600)).should.be.bignumber.equal(baseAcxAmount);
            (await sut.getMintedAmountForTimestampTestable(20 * 365.25 * 24 * 3600)).should.be.bignumber.equal(baseAcxAmount);
        })

        it('minted amount growth is correct with time after inflation update', async() => {
            await timeHelper.setTestRPCTime(genesis.add(10 * 365.25 * 24 * 3600));
            var amount = tokenMultiplier.mul(1000);
            await allocateAndClaim(amount, recipient1);
            await sut.inflationSwitch({from: recipient1});
            const iTime = await timeHelper.executeAndGetTimestamp(async() => {
                return await sut.updateInflation({from: decisionModuleAddr});
            });

            const inflationRate = amount.dividedBy(100);
            baseAcxAmount.should.be.bignumber.equal(await sut.getMintedAmountForTimestampTestable(iTime));
            baseAcxAmount.plus(inflationRate).should.be.bignumber.equal(await sut.getMintedAmountForTimestampTestable(iTime + secondsInOneYear));
            baseAcxAmount.plus(inflationRate.mul(2)).should.be.bignumber.equal(await sut.getMintedAmountForTimestampTestable(iTime + secondsInOneYear * 2));
            baseAcxAmount.plus(inflationRate.mul(5)).should.be.bignumber.equal(await sut.getMintedAmountForTimestampTestable(iTime + secondsInOneYear * 5));
        })

        it('minted amount is correct after several inflation updates', async() => {
            await timeHelper.setTestRPCTime(genesis.add(10 * secondsInOneYear));
            var amount1 = tokenMultiplier.mul(10);
            await allocateAndClaim(amount1, recipient1);
            await sut.inflationSwitch({from: recipient1});
            await sut.updateInflation({from: decisionModuleAddr});

            await timeHelper.setTestRPCTime(genesis.add(11 * secondsInOneYear + 24 * 3600));
            var amount2 = tokenMultiplier.mul(20);
            await allocateAndClaim(amount2, recipient2);
            await sut.inflationSwitch({from: recipient2});
            const iTime = await timeHelper.executeAndGetTimestamp(async() => {
                return await sut.updateInflation({from: decisionModuleAddr});
            });

            const inflationRate1 = amount1.dividedBy(100);
            const mintedAmount1 = await sut.getMintedAmountForTimestampTestable(iTime);
            mintedAmount1.should.be.bignumber.at.least(baseAcxAmount.plus(inflationRate1));

            const inflationRate2 = amount1.plus(amount2).dividedBy(100);
            (await sut.getMintedAmountForTimestampTestable(iTime + secondsInOneYear)).should.be.bignumber.equals(mintedAmount1.plus(inflationRate2));
            (await sut.getMintedAmountForTimestampTestable(iTime + secondsInOneYear * 2)).should.be.bignumber.equals(mintedAmount1.plus(inflationRate2.mul(2)));
            (await sut.getMintedAmountForTimestampTestable(iTime + secondsInOneYear * 5)).should.be.bignumber.equals(mintedAmount1.plus(inflationRate2.mul(5)));
        })

        it('allocation is correct after inflation update', async() => {
            await timeHelper.setTestRPCTime(genesis.add(10 * 365.25 * 24 * 3600));
            var amount = tokenMultiplier.mul(1000);
            await allocateAndClaim(amount, recipient1);
            await sut.inflationSwitch({from: recipient1});
            const iTime = await timeHelper.executeAndGetTimestamp(async() => {
                return await sut.updateInflation({from: decisionModuleAddr});
            });

            // check minted amount and balance after year
            await timeHelper.setTestRPCTime(iTime + secondsInOneYear);
            await sut.allocateACX(0, recipient1, {from: decisionModuleAddr});
            (await sut.ACX_minted()).should.be.bignumber.at.least(baseAcxAmount.plus(amount.dividedBy(100)));
            (await sut.ACX_balance()).should.be.bignumber.at.least(baseAcxAmount.minus(amount).plus(amount.dividedBy(100)));

            // after two years
            await timeHelper.setTestRPCTime(iTime + secondsInOneYear * 2);
            await sut.allocateACX(0, recipient1, {from: decisionModuleAddr});
            (await sut.ACX_minted()).should.be.bignumber.at.least(baseAcxAmount.plus(amount.dividedBy(100).mul(2)));
            (await sut.ACX_balance()).should.be.bignumber.at.least(baseAcxAmount.minus(amount).plus(amount.dividedBy(100).mul(2)));
        })

        it('allocation is correct after several inflation updates', async() => {
            await timeHelper.setTestRPCTime(genesis.add(10 * secondsInOneYear));
            var amount1 = tokenMultiplier.mul(10);
            await allocateAndClaim(amount1, recipient1);
            await sut.inflationSwitch({from: recipient1});
            await sut.updateInflation({from: decisionModuleAddr});

            await timeHelper.setTestRPCTime(genesis.add(11 * secondsInOneYear + 1000));
            var amount2 = tokenMultiplier.mul(20);
            await allocateAndClaim(amount2, recipient2);
            await sut.inflationSwitch({from: recipient2});
            const iTime = await timeHelper.executeAndGetTimestamp(async() => {
                return await sut.updateInflation({from: decisionModuleAddr});
            });

            await timeHelper.setTestRPCTime(iTime + secondsInOneYear);
            await sut.allocateACX(0, recipient1, {from: decisionModuleAddr});

            (await sut.ACX_minted()).should.be.bignumber.at.least(baseAcxAmount.plus(amount1.dividedBy(100)).plus(amount2.dividedBy(100)));
            (await sut.ACX_balance()).should.be.bignumber.at.least(baseAcxAmount.minus(amount1).minus(amount2).plus(amount1.dividedBy(100)).plus(amount2.dividedBy(100)));
        })
    })


    describe('Claim ACX', async() => {
        beforeEach(async function () {
            await deployContracts();
        });

        /**
         * vpredtechenskaya 22.02.2018
         */
        it('Allocate and claim ACX', async () => {
            await timeHelper.setTestRPCTime(genesis.add(30 * 24 * 3600));

            var amount = tokenMultiplier.mul(70000000);
            await sut.allocateACX(amount, recipient1, {from: decisionModuleAddr});
            await sut.claimACX({from: recipient1});
            amount.should.be.bignumber.equal(await token.balanceOf(recipient1));
        });
    })

    describe('Mint ACX', async() => {
        it('', async () => {
            throw new Error("Not implemented");
        });
    })

    describe('Operations with ETH', async() => {

        describe('ETH can be received by IncentivePool', async() => {
            beforeEach(async function () {
                await deployContracts();

            });

            it('Send ETH to contract', async () => {
                // Transfer 6000 ETH to contract
                await sut.sendTransaction({from: accounts[0], to: sut.address, value: ethCap});
            });
        });

        describe('allocateETH method security', async() => {
            before(async function () {
                await deployContracts();
            });

            it('Should be callable by Decision Module', async () => {
                await sut.allocateETH(0, recipient1, {from: decisionModuleAddr}).should.be.fulfilled;
            });

            it('Should be callable by Governance', async () => {
                await sut.allocateETH(0, recipient1, {from: governanceAddr}).should.be.fulfilled;
            });

            it('Should not be callable from non-controller address', async () => {
                await sut.allocateETH(0, recipient1, {from: recipient1}).should.be.rejected;
            });
        });

        describe('Unlock ETH', async() => {
            beforeEach(async function () {
                await deployContracts();

                // Transfer 6000 ETH to contract
                await sut.sendTransaction({from: accounts[0], to: sut.address, value: ethCap});
            });

            it('Unlocked ETH is linear function of time between 0 and 5 years', async () => {
                var secondsIn5Years = 5 * 365.25 * 24 * 60 * 60;
                var iterations = 50;
                var step = parseInt(secondsIn5Years / iterations);

                for (var s = 0; s < secondsIn5Years; s += step) {
                    // Adjust time to s seconds after deployment
                    await timeHelper.setTestRPCTime(genesis.add(s));

                    await sut.allocateETH(0, recipient1, {from: decisionModuleAddr});
                    var ETH_unlocked = web3.toBigNumber(await sut.ETH_unlocked());
                    var ETH_balance = web3.toBigNumber(await sut.ETH_balance());
                    var timeAfter = timeHelper.getCurrentTime();
                    var ETH_unlockedExpectedTop = web3.toBigNumber(timeAfter).mul(ethCap).div(secondsIn5Years);
                    var ETH_unlockedExpectedBottom = web3.toBigNumber(s).mul(ethCap).div(secondsIn5Years);

                    ETH_unlocked.should.be.bignumber.at.least(ETH_unlockedExpectedBottom);
                    ETH_unlocked.should.be.bignumber.at.most(ETH_unlockedExpectedTop);

                    ETH_balance.should.be.bignumber.at.least(ETH_unlockedExpectedBottom);
                    ETH_balance.should.be.bignumber.at.most(ETH_unlockedExpectedTop);
                }
            });

            it('Unlocked ETH is flat function after 5 years', async () => {
                var secondsIn5Years = 5 * 365.25 * 24 * 60 * 60;
                var iterations = 10;
                var step = parseInt(secondsIn5Years / iterations);

                for (var s = secondsIn5Years; s < 2 * secondsIn5Years; s += step) {
                    // Adjust time to s seconds after deployment
                    await timeHelper.setTestRPCTime(genesis.add(s));

                    await sut.allocateETH(0, recipient1, {from: decisionModuleAddr});
                    var ETH_unlocked = web3.toBigNumber(await sut.ETH_unlocked());
                    var ETH_balance = web3.toBigNumber(await sut.ETH_balance());

                    ETH_unlocked.should.be.bignumber.equal(ethCap);
                    ETH_balance.should.be.bignumber.equal(ethCap);
                }

            });
        })

        describe('Allocate and Claim ETH', async() => {
            beforeEach(async function () {
                await deployContracts();

                // Transfer 6000 ETH to contract
                await sut.sendTransaction({from: accounts[0], to: sut.address, value: ethCap});

                // Adjust time to 5 years after deployment
                var secondsIn5Years = 5 * 365.25 * 24 * 60 * 60;
                await timeHelper.setTestRPCTime(genesis.add(secondsIn5Years));

                // Trigger ETH unlock
                await sut.allocateETH(0, recipient1, {from: decisionModuleAddr});
            });

            it('ETH is not allocated above ETH_balance', async () => {
                var ETH_balance = web3.toBigNumber(await sut.ETH_balance());

                await sut.allocateETH(ETH_balance.add(1), recipient1, {from: decisionModuleAddr}).should.be.rejected;
            });

            it('ETH is allocated and ETH_balance is correctly affected', async () => {
                var ETH_balanceBefore = web3.toBigNumber(await sut.ETH_balance());
                await sut.allocateETH(ETH_balanceBefore, recipient1, {from: decisionModuleAddr});
                var allocation = web3.toBigNumber(await sut.ETH_allocations(recipient1));
                var ETH_balanceAfter = web3.toBigNumber(await sut.ETH_balance());
                ETH_balanceAfter.should.be.bignumber.equal(0);
                allocation.should.be.bignumber.equal(ethCap);
            });

            it('Allocated ETH can be transferred to recipient', async () => {
                var ETH_balanceBefore = web3.toBigNumber(await sut.ETH_balance());
                await sut.allocateETH(ETH_balanceBefore, recipient1, {from: decisionModuleAddr});
                var recipientBalanceBefore = web3.toBigNumber(await web3.eth.getBalance(recipient1));
                await sut.claimETH({from: recipient1, gasPrice: 0});
                var recipientBalanceAfter = web3.toBigNumber(await web3.eth.getBalance(recipient1));
                recipientBalanceAfter.sub(recipientBalanceBefore).should.be.bignumber.equal(ETH_balanceBefore);
            });

            it('Allocated ETH can be transferred to two recipients', async () => {
                var ETH_balanceBefore = web3.toBigNumber(await sut.ETH_balance());
                await sut.allocateETH(ETH_balanceBefore.div(2), recipient1, {from: decisionModuleAddr});
                await sut.allocateETH(ETH_balanceBefore.div(2), recipient2, {from: decisionModuleAddr});
                var recipient1BalanceBefore = web3.toBigNumber(await web3.eth.getBalance(recipient1));
                var recipient2BalanceBefore = web3.toBigNumber(await web3.eth.getBalance(recipient2));
                await sut.claimETH({from: recipient1, gasPrice: 0});
                await sut.claimETH({from: recipient2, gasPrice: 0});
                var recipient1BalanceAfter = web3.toBigNumber(await web3.eth.getBalance(recipient1));
                var recipient2BalanceAfter = web3.toBigNumber(await web3.eth.getBalance(recipient2));
                recipient1BalanceAfter.sub(recipient1BalanceBefore).should.be.bignumber.equal(ETH_balanceBefore.div(2));
                recipient2BalanceAfter.sub(recipient2BalanceBefore).should.be.bignumber.equal(ETH_balanceBefore.div(2));
            });
        })
    })



    describe('Inflation Rate', async() => {
        it('', async () => {
            throw new Error("Not implemented");
        });
    })

});
