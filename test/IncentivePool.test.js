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

    let sut;
    let relay;
    let token;
    let preDeploymentTime;
    let pastDeploymentTime;
    let genesis;
    let governanceAddr;
    let decisionModuleAddr;
    let recipient1;
    let tokenMultiplier;

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
    }

    describe('IncentivePool tests', async () => {
        before(async function () {
            governanceAddr = accounts[1];
            decisionModuleAddr = accounts[2];
            recipient1 = accounts[3];

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
                    var curveVal = web3.toBigNumber(await sut.getCurveValueTestable(genesis.add(seconds))).mul(tokenMultiplier);
                    var curveValUpper = web3.toBigNumber(await sut.getCurveValueTestable(genesis.add(seconds + 10))).mul(tokenMultiplier);

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
                    var tolerance = curveValAfter - curveValBefore;

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

        describe('ACX Inflation', async() => {

            let baseAcxAmount;

            beforeEach(async function () {
                await deployContracts();

                // Mint tokens
                // TODO

                // Adjust time to 10 years after deployment
                await timeHelper.setTestRPCTime(genesis.add(10 * 365.25 * 30 * 24 * 3600));

                // Trigger mint
                await sut.allocateACX(0, recipient1, {from: decisionModuleAddr}).should.be.fulfilled;
                baseAcxAmount = web3.toBigNumber(await sut.ACX_minted());
            });

            /* 3 cases:
    			a. last update and now are in deterministic period
    			b. last update is in deterministic period, now is dynamic period
    			c. last update and now are in dynamic period
    		*/

            it('Base amount should be exactly 1.62 billion', async () => {
                baseAcxAmount.should.be.bignumber.equal(1.62e9);
            });

            it('Inflation should be zero without calling updateInflation', async () => {
                // Adjust time to 11 years after deployment
                await timeHelper.setTestRPCTime(genesis.add(10 * 365.25 * 30 * 24 * 3600));

                // Minted amount should still be equal baseAcxAmount
                // TODO


                throw new Error("Not implemented");
            });

            it('updateInflation cannot be called more than once a year', async () => {
                // Vote with all tokens for inflation
                // TODO

                // Call updateInflation first time - expect to fulfil
                // TODO

                // Call updateInflation second time - expect to reject
                // TODO

                // Adjust time to 10 years and 364 days after deployment
                await timeHelper.setTestRPCTime(genesis.add((10 * 365.25 + 364) * 30 * 24 * 3600));

                throw new Error("Not implemented");
            });

            it('update - allocate scenario', async () => {

                //
                //getMintedAmountForTimestampTestable

                // Adjust time to 11 years after deployment
                await timeHelper.setTestRPCTime(genesis.add(10 * 365.25 * 30 * 24 * 3600));


                throw new Error("Not implemented");
            });

            it('update - allocate - allocate scenario', async () => {



                throw new Error("Not implemented");
            });

            it('update - update - allocate scenario', async () => {


                throw new Error("Not implemented");
            });

            it('Token transfer resets vote', async () => {


                throw new Error("Not implemented");
            });

        })


        describe('Claim ACX', async() => {
            it('', async () => {
                throw new Error("Not implemented");
            });
        })

        describe('Mint ACX', async() => {
            it('', async () => {
                throw new Error("Not implemented");
            });
        })

        describe('Unlock ETH', async() => {
            it('', async () => {
                throw new Error("Not implemented");
            });
        })

        describe('Inflation Rate', async() => {
            it('', async () => {
                throw new Error("Not implemented");
            });
        })

    });
});
