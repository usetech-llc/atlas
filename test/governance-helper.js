var tokenInstance;
module.exports.setTokenInstance = (_tokenInstance) => {
	tokenInstance = _tokenInstance;
};

var governanceInstance;
module.exports.setGovernanceInstance = (_governanceInstance) => {
	governanceInstance = _governanceInstance;
};

var decisionModuleInstance;
module.exports.setDecisionModuleInstance = (_decisionModuleInstance) => {
	decisionModuleInstance = _decisionModuleInstance;
};

var relayInstance;
module.exports.setRelayInstance = (_relayInstance) => {
	relayInstance = _relayInstance;
};

var owner;
module.exports.setOwner = (_owner) => {
	owner = _owner;
};

module.exports.submitGovernance = async (accounts , govInstance , govInstanceNext) => {
	var counter = await govInstance.cycleCounter.call();

	var account1 = accounts[5];
	var account2 = accounts[6];
	var account3 = accounts[7];

	var contract1 = accounts[15];
	var contract2 = accounts[16];

	await tokenInstance.transfer(account1 , 10E18 , {from: owner});
	var balanceAccount1 = await tokenInstance.balanceOf.call(account1);

	await tokenInstance.transfer(account2 , 10E18 , {from: owner});
	var balanceAccount2 = await tokenInstance.balanceOf.call(account2);

	await tokenInstance.transfer(account3 , 10E18 , {from: owner});
	var balanceAccount3 = await tokenInstance.balanceOf.call(account3);

	await govInstance.setBlockNumber(166666 , {from: owner});
	await govInstance.submit(contract1 , {from: account1});

	await govInstance.setBlockNumber(166666 , {from: owner});
	await govInstance.submit(contract2 , {from: account2});

	await govInstance.setBlockNumber(166666 , {from: owner});
	await govInstance.submit(govInstanceNext.address , {from: account3});
};

module.exports.chooseGovernance = async (accounts , govInstance , govInstanceNext) => {
	var counter = await govInstance.cycleCounter.call();

	var account1 = accounts[5];
	var account2 = accounts[6];
	var account3 = accounts[7];

	await govInstance.setBlockNumber(166666 * 2 , {from: owner});
	await govInstance.choose(govInstanceNext.address , {from: account1});

	await govInstance.setBlockNumber(166666 * 2 , {from: owner});
	await govInstance.choose(govInstanceNext.address , {from: account2});

	await govInstance.setBlockNumber(166666 * 2 , {from: owner});
	await govInstance.choose(govInstanceNext.address , {from: account3});

	var finalist = await govInstance.finalist.call(counter);
	assert.equal(finalist , govInstanceNext.address , 'finalist should match');
};

module.exports.decideGovernance = async (accounts , govInstance , govInstanceNext , reachQuorum) => {
	var counter = await govInstance.cycleCounter.call();

	var account1 = accounts[5];
	var account2 = accounts[6];
	var account3 = accounts[7];

	await govInstance.setBlockNumber(166666 * 3, {from: owner});

	if(reachQuorum) {
		var tokensInCirculation = await govInstance.tokensInCirculation.call();
		var quorum = await govInstance.quorum.call();
		var tokensForQuorum = tokensInCirculation * quorum / 100;

		await tokenInstance.transfer(account1 , tokensForQuorum * 1E18 , {from: owner});
		var balanceAccount1 = await tokenInstance.balanceOf.call(account1);
	}

	await govInstance.setBlockNumber(166666 * 3, {from: owner});
	await govInstance.decide({from: account1});

	await govInstance.setBlockNumber(166666 * 3, {from: owner});
	await govInstance.decide({from: account2});

	await govInstance.setBlockNumber(166666 * 3, {from: owner});
	await govInstance.decide({from: account3});

	var isQuorumReached = await govInstance.isQuorumReached.call(counter);
	assert.equal(isQuorumReached , reachQuorum , 'isQuorumReached should match');
};

module.exports.closeGovernance = async (accounts , govInstance , govInstanceNext) => {
	var counter = await govInstance.cycleCounter.call();
	var cycle = await govInstance.cycle.call();

	var governanceAddressBefore = await relayInstance.governanceAddress.call();
	var decisionModuleAddressBefore = await relayInstance.decisionModuleAddress.call();
	
	var account1 = accounts[5];
	var account2 = accounts[6];
	var account3 = accounts[7];

	var finalist = await govInstance.finalist.call(counter);
	var finalistSupport = await govInstance.finalistSupport.call(counter);
	var isQuorumReached = await govInstance.isQuorumReached.call(counter);
	// var decided = await govInstance.decided.call(counter);
	
	// console.log('govInstance' ,  govInstance.address);
	// console.log('govInstanceNext' ,  govInstanceNext.address);
	// console.log('finalist' ,  finalist);
	// console.log('finalistSupport' ,  finalistSupport.toNumber());
	// console.log('decided' ,  decided);
	// console.log('isQuorumReached' ,  isQuorumReached);
	// console.log('cycle' ,  cycle.toNumber());
	// console.log('counter' ,  counter.toNumber());


	await govInstance.setBlockNumber(166666 * 4, {from: owner});
	await govInstance.close({from: owner});
	
	var finalist = await govInstance.finalist.call(counter);
	var finalistSupport = await govInstance.finalistSupport.call(counter);
	var isQuorumReached = await govInstance.isQuorumReached.call(counter);
	// var decided = await govInstance.decided.call(counter);
	
	// console.log('-------------------------');	
	// console.log('govInstance' ,  govInstance.address);
	// console.log('govInstanceNext' ,  govInstanceNext.address);
	// console.log('finalist' ,  finalist);
	// console.log('finalistSupport' ,  finalistSupport.toNumber());
	// console.log('decided' ,  decided);
	// console.log('isQuorumReached' ,  isQuorumReached);
	// console.log('cycle' ,  cycle.toNumber());
	// console.log('counter' ,  counter.toNumber());

	if(isQuorumReached) {
		if(cycle == 0) {
			var governanceAddress = await relayInstance.governanceAddress.call();
			assert.equal(governanceAddress , govInstanceNext.address , 'governanceAddress should match');
		} else {
			var decisionModuleAddress = await relayInstance.decisionModuleAddress.call();
			assert.equal(decisionModuleAddress , govInstanceNext.address , 'decisionModuleAddress should match');
		}
	} else {
		if(cycle == 0) {
			var governanceAddress = await relayInstance.governanceAddress.call();
			assert.equal(governanceAddress , governanceAddressBefore , 'governanceAddress should match');
		} else {
			var decisionModuleAddress = await relayInstance.decisionModuleAddress.call();
			assert.equal(decisionModuleAddress , decisionModuleAddressBefore , 'decisionModuleAddress should match');
		}
	}
};


module.exports.pushGovernance = async (accounts , govInstance , contract , account) => {
	var counter = await govInstance.cycleCounter.call();

	await govInstance.setBlockNumber(166666 , {from: owner});
	await govInstance.submit(contract , {from: account});
};

module.exports.voteGovernance = async (accounts , govInstance , contract , account , weight) => {
	var counter = await govInstance.cycleCounter.call();

	await tokenInstance.transfer(account , weight , {from: owner});

	await govInstance.setBlockNumber(166666 * 2 , {from: owner});
	await govInstance.choose(contract , {from: account});
};

module.exports.unvoteGovernance = async (accounts , govInstance , account) => {
	var counter = await govInstance.cycleCounter.call();

	// await govInstance.setBlockNumber(166666 * 2 , {from: owner});
	// await govInstance.decline({from: account});
};

module.exports.supportGovernance = async (accounts , govInstance , account) => {
	var counter = await govInstance.cycleCounter.call();

	await govInstance.setBlockNumber(166666 * 3 , {from: owner});
	await govInstance.decide({from: account});
};