/*

INITIALIZATION
	initialize correct to correct cycle

SUBMIT AMMENDMENT
	throw error if ammendment address added before submission period
	throw error if ammendment address added after submission period
	update ammendments if address added during submission period

ELECT AMMENDMENT
	throw error if election submitted before election period
	throw error if election submitted after election period
	add correct voting weight to ammenments if election submitted during election period for address with 0 weight
	add correct voting weight to ammenments if election submitted for address with non-zero weight
	remove weight if token ownership is transferred
	remove weight if vote is rescinded
	move weight if vote is changed
	update weight to current balance for same ammendment
	update weight if vote is rescinded then recast for same ammendment
	move weight if vote is rescinded then recast for different ammendment

DETERMINE FINALIST
	throw error if election closed before election period is over
	set finalist to ammendment address with most votes
	set finalist to one of the winning addresses in case of a tie (should be random)
	reset ammendments

SUPPORT FINALIST
	throw error if support submitted before decision period
	throw error if support submitted after decision period
	add correct voting weight to finalist
	remove weight if token ownership is transferred
	remove weight if vote is rescinded
  update weight to current balance if voting again
	update weight if vote is rescinded then recast

CLOSE CYCLE
	throw error if cycle closed before decision period is over
	return correct support level based on (support / circulating tokens = )
	reset global variables (finalist, finalist_support)
	increment cycle_counter
	leave Relay variables unchanged if quorum not reached
	change Relay's DM variable to finalist address if this is DM cycle and quorum is reached
	change Relay's G variable to finalist address if this is G cycle and quorum is reached

*/



'use strict';
var assert_throw = require('./helpers/utils').assert_throw;
var AccessToken = artifacts.require("./AccessToken.sol");
var Governance = artifacts.require("./Governance.sol");

const promisify = (inner) =>
	new Promise((resolve, reject) =>
		inner((err, res) => {
			if (err) { reject(err) }
			resolve(res);
		})
);
const getBalance = (account, at) => promisify(cb => web3.eth.getBalance(account, at, cb));
const makeNumber = (number) => {return parseInt(number * 10 ** -18)}; 		

var tokenInstance;
var governanceInstance;

var owner, wallet;

var day = 60 * 60 * 24;
var month = day * 30;
var year = day * 365;


contract('Governance' , (accounts) => {
	owner = accounts[0];
	wallet = accounts[1];
	
	beforeEach(async () => {
		// deploy token contract
		tokenInstance = await AccessToken.new({from: owner});

		// deploy governance contract
		governanceInstance = await Governance.new(tokenInstance.address , {from: owner});

		// mint some tokens to owner
		await tokenInstance.mint(owner , 100000E18 , {from: owner});
		await tokenInstance.mint(accounts[5] , 100E18 , {from: owner});
		await tokenInstance.mint(accounts[6] , 100E18 , {from: owner});
	});

	/* BLOCK NUMBER METHODS */

	it('timestamped : should set blockNumber' , async () => {
		await governanceInstance.setBlockNumber(2000000 , {from: owner});
		var blockNumber = await governanceInstance.getBlockNumber.call();
		assert.equal(blockNumber.toNumber() , 2000000 , 'blockNumber should be set');
	});

	it('timestamped : should get blockNumber' , async () => {
		var blockNumber = await governanceInstance.getBlockNumber.call();
		assert.isTrue(blockNumber.toNumber() > 0 , 'blockNumber should be get');	
	});

	it('timestamped : should reset blockNumber' , async () => {
		await governanceInstance.setBlockNumber(123 , {from: owner});
		var blockNumber = await governanceInstance.getBlockNumber.call();
		assert.equal(blockNumber.toNumber() , 123 , 'blockNumber should be set');

		await governanceInstance.setBlockNumber(0);
		var blockNumber = await governanceInstance.getBlockNumber.call();	
		assert.isTrue(blockNumber > 0 , 'blockNumber should be reset');
	});

	it('governance : initialize : should initialize contract to correct cycle' , async () => {
		var candidateCount = await governanceInstance.candidateCount.call();
		assert.equal(candidateCount.toNumber() , 0 , 'candidateCount should be 0');

		assert_throw(governanceInstance.candidates.call(0));
		
		var finalist = await governanceInstance.finalist.call();
		assert.equal(finalist , 0 , 'finalist should be 0');

		var finalistVotes = await governanceInstance.finalistVotes.call();
		assert.equal(finalistVotes.toNumber() , 0 , 'finalistVotes should be 0');

		var finalistWeight = await governanceInstance.finalistWeight.call();
		assert.equal(finalistWeight.toNumber() , 0 , 'finalistWeight should be 0');

		var finalistSupport = await governanceInstance.finalistSupport.call();
		assert.equal(finalistSupport.toNumber() , 0 , 'finalistSupport should be 0');

		var decided = await governanceInstance.decided.call();
		assert.equal(decided , 0 , 'decided should be 0');

		var decidedVotes = await governanceInstance.decidedVotes.call();
		assert.equal(decidedVotes.toNumber() , 0 , 'decidedVotes should be 0');

		var decidedWeight = await governanceInstance.decidedWeight.call();	
		assert.equal(decidedWeight.toNumber() , 0 , 'decidedWeight should be 0');

		var decidedSupport = await governanceInstance.decidedSupport.call();
		assert.equal(decidedSupport.toNumber() , 0 , 'decidedSupport should be 0');
	});

	it('governance : cycle : should return correct cycle' , async () => {
		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 1 , 'cycle should be 1');
	});

	it('governance : stage : should return correct stage' , async () => {
		await governanceInstance.setBlockNumber(166666 , {from: owner});
		var stage = await governanceInstance.stage.call();
		assert.equal(stage.toNumber() , 1 , 'stage should be 1');
		
		await governanceInstance.setBlockNumber(166666 * 2 , {from: owner});
		var stage = await governanceInstance.stage.call();
		assert.equal(stage.toNumber() , 2 , 'stage should be 2');

		await governanceInstance.setBlockNumber(166666 * 3 , {from: owner});
		var stage = await governanceInstance.stage.call();
		assert.equal(stage.toNumber() , 3 , 'stage should be 3');

		await governanceInstance.setBlockNumber(166666 * 4 , {from: owner});
		var stage = await governanceInstance.stage.call();
		assert.equal(stage.toNumber() , 0 , 'stage should be 0');

		await governanceInstance.setBlockNumber(166666 * 5 , {from: owner});
		var stage = await governanceInstance.stage.call();
		assert.equal(stage.toNumber() , 0 , 'stage should be 0');

		await governanceInstance.setBlockNumber(166666 * 6 , {from: owner});
		var stage = await governanceInstance.stage.call();
		assert.equal(stage.toNumber() , 0 , 'stage should be 0');

		await governanceInstance.setBlockNumber(166666 * 7 , {from: owner});
		var stage = await governanceInstance.stage.call();
		assert.equal(stage.toNumber() , 1 , 'stage should be 1');

		await governanceInstance.setBlockNumber(166666 * 8 , {from: owner});
		var stage = await governanceInstance.stage.call();
		assert.equal(stage.toNumber() , 2 , 'stage should be 2');

		await governanceInstance.setBlockNumber(166666 * 9 , {from: owner});
		var stage = await governanceInstance.stage.call();
		assert.equal(stage.toNumber() , 3 , 'stage should be 3');

		await governanceInstance.setBlockNumber(166666 * 10 , {from: owner});
		var stage = await governanceInstance.stage.call();
		assert.equal(stage.toNumber() , 0 , 'stage should be 0');

	});

	/* SUBMIT CANDIDATE */	
	it('governance : submit : should allow adding candidate during submission period' , async () => {
		var contract1 = accounts[15];

		var candidateCountBefore = await governanceInstance.candidateCount.call();
		assert.equal(candidateCountBefore.toNumber() , 0 , 'candidateCount should be 0');

		var candidateListBefore = await governanceInstance.candidateList.call(contract1);
		assert.equal(candidateListBefore , false , 'candidateList should be false');

		var candidateVotesBefore = await governanceInstance.candidateVotes.call(contract1);
		assert.equal(candidateVotesBefore.toNumber() , 0 , 'candidateVotes should be 0');

		var candidateWeightBefore = await governanceInstance.candidateWeight.call(contract1);
		assert.equal(candidateWeightBefore.toNumber() , 0 , 'candidateWeight should be 0');

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		var candidateCountAfter = await governanceInstance.candidateCount.call();
		assert.equal(candidateCountAfter.toNumber() , 1 , 'candidateCount should be 1');

		var candidate = await governanceInstance.candidates.call(0);
		assert.equal(candidate , contract1 , 'candidate should be set');

		var candidateListAfter = await governanceInstance.candidateList.call(contract1);
		assert.equal(candidateListAfter , true , 'candidateList should be false');

		var candidateVotesAfter = await governanceInstance.candidateVotes.call(contract1);
		assert.equal(candidateVotesAfter.toNumber() , 0 , 'candidateVotes should be 0');

		var candidateWeightAfter = await governanceInstance.candidateWeight.call(contract1);
		assert.equal(candidateWeightAfter.toNumber() , 0 , 'candidateWeight should be 0');
	});

	it('governance : submit : should allow submission the candidate and update the variables' , async () => {
		var contract1 = accounts[15];

		var candidateCountBefore = await governanceInstance.candidateCount.call();
		assert.equal(candidateCountBefore.toNumber() , 0 , 'candidateCount should be 0');

		var candidateListBefore = await governanceInstance.candidateList.call(contract1);
		assert.equal(candidateListBefore , false , 'candidateList should be false');

		var candidateVotesBefore = await governanceInstance.candidateVotes.call(contract1);
		assert.equal(candidateVotesBefore.toNumber() , 0 , 'candidateVotes should be 0');

		var candidateWeightBefore = await governanceInstance.candidateWeight.call(contract1);
		assert.equal(candidateWeightBefore.toNumber() , 0 , 'candidateWeight should be 0');

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		var candidateCountAfter = await governanceInstance.candidateCount.call();
		assert.equal(candidateCountAfter.toNumber() , 1 , 'candidateCount should be 1');

		var candidate = await governanceInstance.candidates.call(0);
		assert.equal(candidate , contract1 , 'candidate should be set');

		var candidateListAfter = await governanceInstance.candidateList.call(contract1);
		assert.equal(candidateListAfter , true , 'candidateList should be false');

		var candidateVotesAfter = await governanceInstance.candidateVotes.call(contract1);
		assert.equal(candidateVotesAfter.toNumber() , 0 , 'candidateVotes should be 0');

		var candidateWeightAfter = await governanceInstance.candidateWeight.call(contract1);
		assert.equal(candidateWeightAfter.toNumber() , 0 , 'candidateWeight should be 0');
	});

	it('governance : submit : should allow submission the two candidate and update the variables' , async () => {
		var contract1 = accounts[15];

		var candidateCountBefore = await governanceInstance.candidateCount.call();
		assert.equal(candidateCountBefore.toNumber() , 0 , 'candidateCount should be 0');

		var candidateListBefore = await governanceInstance.candidateList.call(contract1);
		assert.equal(candidateListBefore , false , 'candidateList should be false');

		var candidateVotesBefore = await governanceInstance.candidateVotes.call(contract1);
		assert.equal(candidateVotesBefore.toNumber() , 0 , 'candidateVotes should be 0');

		var candidateWeightBefore = await governanceInstance.candidateWeight.call(contract1);
		assert.equal(candidateWeightBefore.toNumber() , 0 , 'candidateWeight should be 0');

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		var candidateCountAfter = await governanceInstance.candidateCount.call();
		assert.equal(candidateCountAfter.toNumber() , 1 , 'candidateCount should be 1');

		var candidate = await governanceInstance.candidates.call(0);
		assert.equal(candidate , contract1 , 'candidate should be set');

		var candidateListAfter = await governanceInstance.candidateList.call(contract1);
		assert.equal(candidateListAfter , true , 'candidateList should be false');

		var candidateVotesAfter = await governanceInstance.candidateVotes.call(contract1);
		assert.equal(candidateVotesAfter.toNumber() , 0 , 'candidateVotes should be 0');

		var candidateWeightAfter = await governanceInstance.candidateWeight.call(contract1);
		assert.equal(candidateWeightAfter.toNumber() , 0 , 'candidateWeight should be 0');

		// add candidate 2
		var contract2 = accounts[16];

		var candidateCountBefore = await governanceInstance.candidateCount.call();
		assert.equal(candidateCountBefore.toNumber() , 1 , 'candidateCount should be 0');

		var candidateListBefore = await governanceInstance.candidateList.call(contract2);
		assert.equal(candidateListBefore , false , 'candidateList should be false');

		var candidateVotesBefore = await governanceInstance.candidateVotes.call(contract2);
		assert.equal(candidateVotesBefore.toNumber() , 0 , 'candidateVotes should be 0');

		var candidateWeightBefore = await governanceInstance.candidateWeight.call(contract2);
		assert.equal(candidateWeightBefore.toNumber() , 0 , 'candidateWeight should be 0');

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		var candidateCountAfter = await governanceInstance.candidateCount.call();
		assert.equal(candidateCountAfter.toNumber() , 2 , 'candidateCount should be 1');

		var candidate = await governanceInstance.candidates.call(1);
		assert.equal(candidate , contract2 , 'candidate should be set');

		var candidateListAfter = await governanceInstance.candidateList.call(contract2);
		assert.equal(candidateListAfter , true , 'candidateList should be false');

		var candidateVotesAfter = await governanceInstance.candidateVotes.call(contract2);
		assert.equal(candidateVotesAfter.toNumber() , 0 , 'candidateVotes should be 0');

		var candidateWeightAfter = await governanceInstance.candidateWeight.call(contract2);
		assert.equal(candidateWeightAfter.toNumber() , 0 , 'candidateWeight should be 0');
	});

	it('governance : submit : should throw error if candidate address added before submission period' , async () => {
		var contract1 = accounts[15];

		var candidateCountBefore = await governanceInstance.candidateCount.call();
		assert.equal(candidateCountBefore.toNumber() , 0 , 'candidateCount should be 0');

		await governanceInstance.setBlockNumber(166666 * 6 , {from: owner});
		assert_throw(governanceInstance.submit(contract1 , {from: contract1}));

		var candidateCountAfter = await governanceInstance.candidateCount.call();
		assert.equal(candidateCountAfter.toNumber() , 0 , 'candidateCount should be 0');
	});	

	it('governance : submit : should allow if candidate address added middle of submission period' , async () => {
		var contract1 = accounts[15];

		var candidateCountBefore = await governanceInstance.candidateCount.call();
		assert.equal(candidateCountBefore.toNumber() , 0 , 'candidateCount should be 0');

		await governanceInstance.setBlockNumber(166666 * 7 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		var candidateCountAfter = await governanceInstance.candidateCount.call();
		assert.equal(candidateCountAfter.toNumber() , 1 , 'candidateCount should be 1');
	});	

	it('governance : submit : should throw error if candidate address added after submission period' , async () => {
		var contract1 = accounts[15];

		var candidateCountBefore = await governanceInstance.candidateCount.call();
		assert.equal(candidateCountBefore.toNumber() , 0 , 'candidateCount should be 0');

		await governanceInstance.setBlockNumber(166666 * 8 , {from: owner});
		assert_throw(governanceInstance.submit(contract1 , {from: contract1}));

		var candidateCountAfter = await governanceInstance.candidateCount.call();
		assert.equal(candidateCountAfter.toNumber() , 0 , 'candidateCount should be 0');
	});

	it('governance : submit : should not allow double submission of candidate' , async () => {
		await governanceInstance.setBlockNumber(166666 , {from: owner});

		var candidateCountBefore = await governanceInstance.candidateCount.call();
		assert.equal(candidateCountBefore.toNumber() , 0 , 'candidateCount should be 0');

		var contract1 = accounts[15];
		await governanceInstance.submit(contract1 , {from: contract1});

		var candidateCountAfter = await governanceInstance.candidateCount.call();
		assert.equal(candidateCountAfter.toNumber() , 1 , 'candidateCount should be 1');

		var candidateCountBefore = await governanceInstance.candidateCount.call();
		assert.equal(candidateCountBefore.toNumber() , 1 , 'candidateCount should be 1');

		var contract2 = accounts[16];
		await governanceInstance.submit(contract2 , {from: contract2});

		var candidateCountAfter = await governanceInstance.candidateCount.call();
		assert.equal(candidateCountAfter.toNumber() , 2 , 'candidateCount should be 2');

		var candidateCountBefore = await governanceInstance.candidateCount.call();
		assert.equal(candidateCountBefore.toNumber() , 2 , 'candidateCount should be 2');

		var contract2 = accounts[16];
		assert_throw(governanceInstance.submit(contract2 , {from: contract2}));

		var candidateCountAfter = await governanceInstance.candidateCount.call();
		assert.equal(candidateCountAfter.toNumber() , 2 , 'candidateCount should be 2');

		var candidateCountBefore = await governanceInstance.candidateCount.call();
		assert.equal(candidateCountBefore.toNumber() , 2 , 'candidateCount should be 2');

		var contract1 = accounts[15];
		assert_throw(governanceInstance.submit(contract1 , {from: contract1}));

		var candidateCountAfter = await governanceInstance.candidateCount.call();
		assert.equal(candidateCountAfter.toNumber() , 2 , 'candidateCount should be 2');

		var candidateCountBefore = await governanceInstance.candidateCount.call();
		assert.equal(candidateCountBefore.toNumber() , 2 , 'candidateCount should be 2');

		var contract3 = accounts[17];
		await governanceInstance.submit(contract3 , {from: contract3});

		var candidateCountAfter = await governanceInstance.candidateCount.call();
		assert.equal(candidateCountAfter.toNumber() , 3 , 'candidateCount should be 3');
	});



	/* CHOOSE CANDIDATE */	
	it('governance : choose : should allow voting the candidate during period' , async () => {
		var account1 = accounts[5];
		var account2 = accounts[6];

		var contract1 = accounts[15];
		var contract2 = accounts[16];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});
	});

	it('governance : choose : should allow voting the candidate during period and verify votes, weight' , async () => {
		var account1 = accounts[5];
		var account2 = accounts[6];

		var contract1 = accounts[15];
		var contract2 = accounts[16];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		var candidateVotesBefore = await governanceInstance.candidateVotes.call(contract1);
		assert.equal(candidateVotesBefore , 0 , 'candidateVotes should be 0');

		var candidateWeightBefore = await governanceInstance.candidateWeight.call(contract1);
		assert.equal(candidateWeightBefore , 0 , 'candidateWeight should be 0');

		var candidateVotersBefore = await governanceInstance.candidateVoters.call(contract1 , account1);
		assert.equal(candidateVotersBefore , 0 , 'candidateVoters should be 0');

		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		var balance = await tokenInstance.balanceOf.call(account1);
		
		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		var candidateVotesAfter = await governanceInstance.candidateVotes.call(contract1);
		assert.equal(candidateVotesAfter.toNumber() , 1 , 'candidateVotes should be 1');

		var candidateWeightAfter = await governanceInstance.candidateWeight.call(contract1);
		assert.equal(candidateWeightAfter.toNumber() , balance.toNumber() , 'candidateWeight should be 10E18');

		var candidateVotersAfter = await governanceInstance.candidateVoters.call(contract1 , account1);
		assert.equal(candidateVotersAfter.toNumber() , balance.toNumber() , 'candidateVoters should be 10E18');

	});

	it('governance : choose : should allow voting the candidate during period with two accounts and verify votes, weight' , async () => {
		var account1 = accounts[5];
		var account2 = accounts[6];

		var contract1 = accounts[15];
		var contract2 = accounts[16];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		var candidateVotesBefore = await governanceInstance.candidateVotes.call(contract1);
		assert.equal(candidateVotesBefore , 0 , 'candidateVotes should be 0');

		var candidateWeightBefore = await governanceInstance.candidateWeight.call(contract1);
		assert.equal(candidateWeightBefore , 0 , 'candidateWeight should be 0');

		var candidateVotersBefore = await governanceInstance.candidateVoters.call(contract1 , account1);
		assert.equal(candidateVotersBefore , 0 , 'candidateVoters should be 0');

		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		var balanceAccount1 = await tokenInstance.balanceOf.call(account1);
		
		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		var candidateVotesAfter = await governanceInstance.candidateVotes.call(contract1);
		assert.equal(candidateVotesAfter.toNumber() , 1 , 'candidateVotes should be 1');

		var candidateWeightAfter = await governanceInstance.candidateWeight.call(contract1);
		assert.equal(candidateWeightAfter.toNumber() , balanceAccount1.toNumber() , 'candidateWeight should be 10E18');

		var candidateVotersAfter = await governanceInstance.candidateVoters.call(contract1 , account1);
		assert.equal(candidateVotersAfter.toNumber() , balanceAccount1.toNumber() , 'candidateVoters should be 10E18');


		var candidateVotesBefore = await governanceInstance.candidateVotes.call(contract1);
		assert.equal(candidateVotesBefore , 1 , 'candidateVotes should be 1');

		var candidateWeightBefore = await governanceInstance.candidateWeight.call(contract1);
		assert.equal(candidateWeightBefore , balanceAccount1.toNumber() , 'candidateWeight should be balanceAccount1');

		var candidateVotersBefore = await governanceInstance.candidateVoters.call(contract1 , account1);
		assert.equal(candidateVotersBefore , balanceAccount1.toNumber() , 'candidateVoters should be balanceAccount1');

		var candidateVotersBefore = await governanceInstance.candidateVoters.call(contract1 , account2);
		assert.equal(candidateVotersBefore , 0 , 'candidateVoters should be balanceAccount1');

		await tokenInstance.transfer(account2 , 10E18 , {from: owner});
		var balanceAccount2 = await tokenInstance.balanceOf.call(account2);

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await governanceInstance.choose(contract1 , {from: account2});

		var candidateVotesAfter = await governanceInstance.candidateVotes.call(contract1);
		assert.equal(candidateVotesAfter.toNumber() , 2 , 'candidateVotes should be 2');

		var candidateWeightAfter = await governanceInstance.candidateWeight.call(contract1);
		assert.equal(candidateWeightAfter.toNumber() , balanceAccount1.toNumber() + balanceAccount2.toNumber() , 'candidateWeight should be 20E18');

		var candidateVotersAfter = await governanceInstance.candidateVoters.call(contract1 , account1);
		assert.equal(candidateVotersAfter.toNumber() , balanceAccount1.toNumber() , 'candidateVoters should be 10E18');

		var candidateVotersAfter = await governanceInstance.candidateVoters.call(contract1 , account2);
		assert.equal(candidateVotersAfter.toNumber() , balanceAccount2.toNumber() , 'candidateVoters should be 10E18');

	});

	it('governance : choose : should allow voting the candidate and update the finalist' , async () => {
		var account1 = accounts[5];
		var account2 = accounts[6];
		var account3 = accounts[7];
		var account4 = accounts[8];

		var contract1 = accounts[15];
		var contract2 = accounts[16];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		var finalistBefore = await governanceInstance.finalist.call();
		assert.equal(finalistBefore , 0 , 'finalist should be 0');
		
		var finalistVotesBefore = await governanceInstance.finalistVotes.call();
		assert.equal(finalistVotesBefore.toNumber() , 0 , 'finalistVotes should be 0');	

		var finalistWeightBefore = await governanceInstance.finalistWeight.call();
		assert.equal(finalistWeightBefore.toNumber() , 0 , 'finalistWeight should be 0');	

		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		var balanceAccount1 = await tokenInstance.balanceOf.call(account1);
		
		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		var finalistBefore = await governanceInstance.finalist.call();
		assert.equal(finalistBefore , contract1 , 'finalist should be contract1');
		
		var finalistVotesBefore = await governanceInstance.finalistVotes.call();
		assert.equal(finalistVotesBefore.toNumber() , 1 , 'finalistVotes should be 1');	

		var finalistWeightBefore = await governanceInstance.finalistWeight.call();
		assert.equal(finalistWeightBefore.toNumber() , balanceAccount1.toNumber() , 'finalistWeight should be 10E18');	
	});

	it('governance : choose : should allow voting the multiple candidates and update the finalist' , async () => {
		var account1 = accounts[5];
		var account2 = accounts[6];
		var account3 = accounts[7];
		var account4 = accounts[8];

		var contract1 = accounts[15];
		var contract2 = accounts[16];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		var finalistBefore = await governanceInstance.finalist.call();
		assert.equal(finalistBefore , 0 , 'finalist should be 0');
		
		var finalistVotesBefore = await governanceInstance.finalistVotes.call();
		assert.equal(finalistVotesBefore.toNumber() , 0 , 'finalistVotes should be 0');	

		var finalistWeightBefore = await governanceInstance.finalistWeight.call();
		assert.equal(finalistWeightBefore.toNumber() , 0 , 'finalistWeight should be 0');	

		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		var balanceAccount1 = await tokenInstance.balanceOf.call(account1);
		
		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		var finalistBefore = await governanceInstance.finalist.call();
		assert.equal(finalistBefore , contract1 , 'finalist should be contract1');
		
		var finalistVotesBefore = await governanceInstance.finalistVotes.call();
		assert.equal(finalistVotesBefore.toNumber() , 1 , 'finalistVotes should be 1');	

		var finalistWeightBefore = await governanceInstance.finalistWeight.call();
		assert.equal(finalistWeightBefore.toNumber() , balanceAccount1.toNumber() , 'finalistWeight should be 10E18');	


		// SECOND VOTING

		var finalistBefore = await governanceInstance.finalist.call();
		assert.equal(finalistBefore , contract1 , 'finalist should be contract1');
		
		var finalistVotesBefore = await governanceInstance.finalistVotes.call();
		assert.equal(finalistVotesBefore.toNumber() , 1 , 'finalistVotes should be 1');	

		var finalistWeightBefore = await governanceInstance.finalistWeight.call();
		assert.equal(finalistWeightBefore.toNumber() , balanceAccount1.toNumber() , 'finalistWeight should be balance');	

		await tokenInstance.transfer(account2 , 100E18 , {from: owner});
		var balanceAccount2 = await tokenInstance.balanceOf.call(account2);
		
		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await governanceInstance.choose(contract1 , {from: account2});

		var finalistBefore = await governanceInstance.finalist.call();
		assert.equal(finalistBefore , contract1 , 'finalist should be contract1');
		
		var finalistVotesBefore = await governanceInstance.finalistVotes.call();
		assert.equal(finalistVotesBefore.toNumber() , 2 , 'finalistVotes should be 1');	

		var finalistWeightBefore = await governanceInstance.finalistWeight.call();
		assert.equal(finalistWeightBefore.toNumber() , balanceAccount1.toNumber() + balanceAccount2.toNumber() , 'finalistWeight should be 10E18');	


		// THIRD VOTING

		var finalistBefore = await governanceInstance.finalist.call();
		assert.equal(finalistBefore , contract1 , 'finalist should be contract1');
		
		var finalistVotesBefore = await governanceInstance.finalistVotes.call();
		assert.equal(finalistVotesBefore.toNumber() , 2 , 'finalistVotes should be 1');	

		var finalistWeightBefore = await governanceInstance.finalistWeight.call();
		assert.equal(finalistWeightBefore.toNumber() , balanceAccount1.toNumber() + balanceAccount2.toNumber() , 'finalistWeight should be balance');	

		await tokenInstance.transfer(account3 , 1200E18 , {from: owner});
		var balanceAccount3 = await tokenInstance.balanceOf.call(account3);
		
		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await governanceInstance.choose(contract2 , {from: account3});

		var finalistBefore = await governanceInstance.finalist.call();
		assert.equal(finalistBefore , contract2 , 'finalist should be contract1');
		
		var finalistVotesBefore = await governanceInstance.finalistVotes.call();
		assert.equal(finalistVotesBefore.toNumber() , 1 , 'finalistVotes should be 1');	

		var finalistWeightBefore = await governanceInstance.finalistWeight.call();
		assert.equal(finalistWeightBefore.toNumber() , balanceAccount3.toNumber() , 'finalistWeight should be 10E18');	


		// FOURTH VOTING

		var finalistBefore = await governanceInstance.finalist.call();
		assert.equal(finalistBefore , contract2 , 'finalist should be contract1');
		
		var finalistVotesBefore = await governanceInstance.finalistVotes.call();
		assert.equal(finalistVotesBefore.toNumber() , 1 , 'finalistVotes should be 1');	

		var finalistWeightBefore = await governanceInstance.finalistWeight.call();
		assert.equal(finalistWeightBefore.toNumber() , balanceAccount3.toNumber() , 'finalistWeight should be balance');	

		await tokenInstance.transfer(account4 , 1100E18 , {from: owner});
		var balanceAccount4 = await tokenInstance.balanceOf.call(account4);
		
		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await governanceInstance.choose(contract1 , {from: account4});

		var finalistBefore = await governanceInstance.finalist.call();
		assert.equal(finalistBefore , contract1 , 'finalist should be contract1');
		
		var finalistVotesBefore = await governanceInstance.finalistVotes.call();
		assert.equal(finalistVotesBefore.toNumber() , 3 , 'finalistVotes should be 1');	

		var finalistWeightBefore = await governanceInstance.finalistWeight.call();
		assert.equal(finalistWeightBefore.toNumber() , balanceAccount1.toNumber() + balanceAccount2.toNumber() + balanceAccount4.toNumber() , 'finalistWeight should be 10E18');	
	});

	it('governance : choose : should not allow if candidate address is invalid' , async () => {
		var account1 = accounts[5];
		var contract1 = accounts[15];

		var finalistBefore = await governanceInstance.finalist.call();
		assert.equal(finalistBefore , 0 , 'finalist should be 0');

		await tokenInstance.transfer(account1 , 100E18 , {from: owner});
		var balanceAccount1 = await tokenInstance.balanceOf.call(account1);

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		assert_throw(governanceInstance.choose(contract1 , {from: account1}));

		var finalistAfter = await governanceInstance.finalist.call();
		assert.equal(finalistAfter , 0 , 'finalist should be 0');
	});

	it('governance : choose : should throw error if candidate address added before choose period' , async () => {
		var account1 = accounts[5];
		var contract1 = accounts[15];

		var finalistBefore = await governanceInstance.finalist.call();
		assert.equal(finalistBefore , 0 , 'finalist should be 0');

		await tokenInstance.transfer(account1 , 100E18 , {from: owner});
		var balanceAccount1 = await tokenInstance.balanceOf.call(account1);

		await governanceInstance.setBlockNumber(166666 * 7 , {from: owner});
		assert_throw(governanceInstance.choose(contract1 , {from: account1}));

		var finalistAfter = await governanceInstance.finalist.call();
		assert.equal(finalistAfter , 0 , 'finalist should be 0');
	});	

	it('governance : choose : should allow if candidate address added middle of choose period' , async () => {
		var account1 = accounts[5];
		var contract1 = accounts[15];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: account1});

		var finalistBefore = await governanceInstance.finalist.call();
		assert.equal(finalistBefore , 0 , 'finalist should be 0');

		await tokenInstance.transfer(account1 , 100E18 , {from: owner});
		var balanceAccount1 = await tokenInstance.balanceOf.call(account1);

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		var finalistAfter = await governanceInstance.finalist.call();
		assert.equal(finalistAfter , contract1 , 'finalist should be 0');
	});	

	it('governance : choose : should throw error if candidate address added after choose period' , async () => {
		var account1 = accounts[5];
		var contract1 = accounts[15];

		var finalistBefore = await governanceInstance.finalist.call();
		assert.equal(finalistBefore , 0 , 'finalist should be 0');

		await tokenInstance.transfer(account1 , 100E18 , {from: owner});
		var balanceAccount1 = await tokenInstance.balanceOf.call(account1);

		await governanceInstance.setBlockNumber(166666 * 9 , {from: owner});
		assert_throw(governanceInstance.choose(contract1 , {from: account1}));

		var finalistAfter = await governanceInstance.finalist.call();
		assert.equal(finalistAfter , 0 , 'finalist should be 0');
	});

	it('governance : choose : should not allow voting the multiple candidates from single account' , async () => {
		var account1 = accounts[5];
		var contract1 = accounts[15];

		var account2 = accounts[6];
		var contract2 = accounts[16];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: account2});

		var finalistBefore = await governanceInstance.finalist.call();
		assert.equal(finalistBefore , 0 , 'finalist should be 0');

		await tokenInstance.transfer(account1 , 100E18 , {from: owner});
		var balanceAccount1 = await tokenInstance.balanceOf.call(account1);

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		var finalistAfter = await governanceInstance.finalist.call();
		assert.equal(finalistAfter , contract1 , 'finalist should be 0');

		var finalistBefore = await governanceInstance.finalist.call();
		assert.equal(finalistBefore , contract1 , 'finalist should be 0');

		await tokenInstance.transfer(account1 , 100E18 , {from: owner});
		var balanceAccount1 = await tokenInstance.balanceOf.call(account1);

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		assert_throw(governanceInstance.choose(contract2 , {from: account1}));

		var finalistAfter = await governanceInstance.finalist.call();
		assert.equal(finalistAfter , contract1 , 'finalist should be 0');
	});

	it('governance : choose : should throw error if voters does not have enough tokens' , async () => {
		var account1 = accounts[10];
		var contract1 = accounts[15];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: account1});

		var finalistBefore = await governanceInstance.finalist.call();
		assert.equal(finalistBefore , 0 , 'finalist should be 0');

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		assert_throw(governanceInstance.choose(contract1 , {from: account1}));

		var finalistAfter = await governanceInstance.finalist.call();
		assert.equal(finalistAfter , 0 , 'finalist should be 0');
	});

	it('governance : choose : should not allow double voting the candidate during period' , async () => {
		var account1 = accounts[5];
		var contract1 = accounts[15];

		var account2 = accounts[6];
		var contract2 = accounts[16];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: account2});

		// FIRST VOTE 

		var finalistBefore = await governanceInstance.finalist.call();
		assert.equal(finalistBefore , 0 , 'finalist should be 0');

		await tokenInstance.transfer(account1 , 100E18 , {from: owner});
		var balanceAccount1 = await tokenInstance.balanceOf.call(account1);

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		var finalistAfter = await governanceInstance.finalist.call();
		assert.equal(finalistAfter , contract1 , 'finalist should be 0');

		// SECOND VOTE 

		var finalistBefore = await governanceInstance.finalist.call();
		assert.equal(finalistBefore , contract1 , 'finalist should be 0');

		await tokenInstance.transfer(account2 , 150E18 , {from: owner});
		var balanceAccount2 = await tokenInstance.balanceOf.call(account2);

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await governanceInstance.choose(contract2 , {from: account2});

		var finalistAfter = await governanceInstance.finalist.call();
		assert.equal(finalistAfter , contract2 , 'finalist should be 0');

		// THIRD VOTE 
		
		var finalistBefore = await governanceInstance.finalist.call();
		assert.equal(finalistBefore , contract2 , 'finalist should be 0');

		await tokenInstance.transfer(account1 , 200E18 , {from: owner});
		var balanceAccount1 = await tokenInstance.balanceOf.call(account1);

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		assert_throw(governanceInstance.choose(contract1 , {from: account1}));

		var finalistAfter = await governanceInstance.finalist.call();
		assert.equal(finalistAfter , contract2 , 'finalist should be 0');
	});

	/* DECIDE CANDIDATE */
	it('governance : decide : should allow decide the finalist during decide period' , async () => {
		var account1 = accounts[5];
		var account2 = accounts[6];

		var contract1 = accounts[15];
		var contract2 = accounts[16];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account2 , 100E18 , {from: owner});
		await governanceInstance.choose(contract2 , {from: account2});

		var balanceAccount1 = await tokenInstance.balanceOf(account1);
		var balanceAccount2 = await tokenInstance.balanceOf(account2);

		var finalist = await governanceInstance.finalist.call();
		assert.equal(finalist , contract2 , 'finalist should match');

		var finalistSupportersBefore = await governanceInstance.finalistSupporters.call(account2);
		assert.equal(finalistSupportersBefore.toNumber() , 0 , 'finalistSupporters should match');

		var finalistSupportBefore = await governanceInstance.finalistSupport.call();
		assert.equal(finalistSupportBefore.toNumber() , 0 , 'finalistSupporters should match');

		var isQuorumReached = await governanceInstance.isQuorumReached.call();
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account2});
		
		var finalistSupportersBefore = await governanceInstance.finalistSupporters.call(account2);
		assert.equal(finalistSupportersBefore.toNumber() , balanceAccount2.toNumber() , 'finalistSupporters should match');

		var finalistSupportBefore = await governanceInstance.finalistSupport.call();
		assert.equal(finalistSupportBefore.toNumber() , balanceAccount2.toNumber() , 'finalistSupporters should match');
		
		var isQuorumReached = await governanceInstance.isQuorumReached.call();
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');

	});

	it('governance : decide : should allow decide the finalist during period and verify votes, weight' , async () => {
		var account1 = accounts[5];
		var account2 = accounts[6];

		var contract1 = accounts[15];
		var contract2 = accounts[16];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account2 , 100E18 , {from: owner});
		await governanceInstance.choose(contract2 , {from: account2});

		var balanceAccount1 = await tokenInstance.balanceOf(account1);
		var balanceAccount2 = await tokenInstance.balanceOf(account2);

		var finalist = await governanceInstance.finalist.call();
		assert.equal(finalist , contract2 , 'finalist should match');

		// CHOOSE FIRST

		var finalistSupportersBefore = await governanceInstance.finalistSupporters.call(account2);
		assert.equal(finalistSupportersBefore.toNumber() , 0 , 'finalistSupporters should match');

		var finalistSupportBefore = await governanceInstance.finalistSupport.call();
		assert.equal(finalistSupportBefore.toNumber() , 0 , 'finalistSupporters should match');

		var isQuorumReached = await governanceInstance.isQuorumReached.call();
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');
		

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account2});

		var finalistSupportersBefore = await governanceInstance.finalistSupporters.call(account2);
		assert.equal(finalistSupportersBefore.toNumber() , balanceAccount2.toNumber() , 'finalistSupporters should match');

		var finalistSupportBefore = await governanceInstance.finalistSupport.call();
		assert.equal(finalistSupportBefore.toNumber() , balanceAccount2.toNumber() , 'finalistSupporters should match');
		
		var isQuorumReached = await governanceInstance.isQuorumReached.call();
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');

		// CHOOSE SECOND

		var finalistSupportersBefore = await governanceInstance.finalistSupporters.call(account2);
		assert.equal(finalistSupportersBefore.toNumber() , balanceAccount2.toNumber() , 'finalistSupporters should match');

		var finalistSupportersBefore = await governanceInstance.finalistSupporters.call(account1);
		assert.equal(finalistSupportersBefore.toNumber() , 0 , 'finalistSupporters should match');

		var finalistSupportBefore = await governanceInstance.finalistSupport.call();
		assert.equal(finalistSupportBefore.toNumber() , balanceAccount2.toNumber() , 'finalistSupporters should match');

		var isQuorumReached = await governanceInstance.isQuorumReached.call();
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account1});

		var finalistSupportersBefore = await governanceInstance.finalistSupporters.call(account2);
		assert.equal(finalistSupportersBefore.toNumber() , balanceAccount2.toNumber() , 'finalistSupporters should match');

		var finalistSupportersBefore = await governanceInstance.finalistSupporters.call(account1);
		assert.equal(finalistSupportersBefore.toNumber() , balanceAccount1.toNumber() , 'finalistSupporters should match');

		var finalistSupportBefore = await governanceInstance.finalistSupport.call();
		assert.equal(finalistSupportBefore.toNumber() , balanceAccount1.toNumber() + balanceAccount2.toNumber() , 'finalistSupporters should match');

		var isQuorumReached = await governanceInstance.isQuorumReached.call();
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');
	});

	it('governance : decide : should allow support the finalist and verify quorum reached' , async () => {
		var account1 = accounts[5];
		var account2 = accounts[6];

		var contract1 = accounts[15];
		var contract2 = accounts[16];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account2 , 100E18 , {from: owner});
		await governanceInstance.choose(contract2 , {from: account2});

		await tokenInstance.mint(account1 , 900E18 , {from: owner});
		await tokenInstance.mint(account2 , 900E18 , {from: owner});

		var balanceAccount1 = await tokenInstance.balanceOf(account1);
		var balanceAccount2 = await tokenInstance.balanceOf(account2);

		var finalist = await governanceInstance.finalist.call();
		assert.equal(finalist , contract2 , 'finalist should match');

		// CHOOSE FIRST
		var isQuorumReached = await governanceInstance.isQuorumReached.call();
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account2});

		var isQuorumReached = await governanceInstance.isQuorumReached.call();
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');

		var finalistSupport = await governanceInstance.finalistSupport.call();
		assert.equal(finalistSupport.toNumber() , balanceAccount2.toNumber() , 'finalistSupport should match');

		// CHOOSE SECOND
		var isQuorumReached = await governanceInstance.isQuorumReached.call();
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account1});

		var isQuorumReached = await governanceInstance.isQuorumReached.call();
		assert.equal(isQuorumReached , true , 'isQuorumReached should match');

		var finalistSupport = await governanceInstance.finalistSupport.call();
		assert.equal(finalistSupport.toNumber() , balanceAccount1.toNumber() + balanceAccount2.toNumber() , 'finalistSupport should match');
	});

	it('governance : decide : should throw error if finalist address supported before decide period' , async () => {
		var account1 = accounts[5];
		var account2 = accounts[6];

		var contract1 = accounts[15];
		var contract2 = accounts[16];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account2 , 100E18 , {from: owner});
		await governanceInstance.choose(contract2 , {from: account2});

		await tokenInstance.mint(account1 , 900E18 , {from: owner});
		await tokenInstance.mint(account2 , 900E18 , {from: owner});

		var balanceAccount1 = await tokenInstance.balanceOf(account1);
		var balanceAccount2 = await tokenInstance.balanceOf(account2);

		var finalist = await governanceInstance.finalist.call();
		assert.equal(finalist , contract2 , 'finalist should match');

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		assert_throw(governanceInstance.decide({from: account2}));

		var isQuorumReached = await governanceInstance.isQuorumReached.call();
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');

		var finalistSupport = await governanceInstance.finalistSupport.call();
		assert.equal(finalistSupport , 0 , 'finalistSupport should match');
	});

	it('governance : decide : should allow if finalist address supported middle decide period' , async () => {
		var account1 = accounts[5];
		var account2 = accounts[6];

		var contract1 = accounts[15];
		var contract2 = accounts[16];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account2 , 100E18 , {from: owner});
		await governanceInstance.choose(contract2 , {from: account2});

		await tokenInstance.mint(account1 , 900E18 , {from: owner});
		await tokenInstance.mint(account2 , 900E18 , {from: owner});

		var balanceAccount1 = await tokenInstance.balanceOf(account1);
		var balanceAccount2 = await tokenInstance.balanceOf(account2);

		var finalist = await governanceInstance.finalist.call();
		assert.equal(finalist , contract2 , 'finalist should match');

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account2});

		var isQuorumReached = await governanceInstance.isQuorumReached.call();
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');

		var finalistSupport = await governanceInstance.finalistSupport.call();
		assert.equal(finalistSupport.toNumber() , balanceAccount2.toNumber() , 'finalistSupport should match');
	});

	it('governance : decide : should throw error if finalist address supported after decide period' , async () => {
		var account1 = accounts[5];
		var account2 = accounts[6];

		var contract1 = accounts[15];
		var contract2 = accounts[16];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account2 , 100E18 , {from: owner});
		await governanceInstance.choose(contract2 , {from: account2});

		await tokenInstance.mint(account1 , 900E18 , {from: owner});
		await tokenInstance.mint(account2 , 900E18 , {from: owner});

		var balanceAccount1 = await tokenInstance.balanceOf(account1);
		var balanceAccount2 = await tokenInstance.balanceOf(account2);

		var finalist = await governanceInstance.finalist.call();
		assert.equal(finalist , contract2 , 'finalist should match');

		await governanceInstance.setBlockNumber(166666 * 4, {from: owner});
		assert_throw(governanceInstance.decide({from: account2}));

		var isQuorumReached = await governanceInstance.isQuorumReached.call();
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');

		var finalistSupport = await governanceInstance.finalistSupport.call();
		assert.equal(finalistSupport , 0 , 'finalistSupport should match');
	});

	it('governance : decide : should throw error if support does not have enough tokens' , async () => {
		var account1 = accounts[5];
		var account2 = accounts[6];
		var account3 = accounts[7];

		var contract1 = accounts[15];
		var contract2 = accounts[16];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account2 , 100E18 , {from: owner});
		await governanceInstance.choose(contract2 , {from: account2});

		await tokenInstance.mint(account1 , 900E18 , {from: owner});
		await tokenInstance.mint(account2 , 900E18 , {from: owner});

		var balanceAccount1 = await tokenInstance.balanceOf(account1);
		var balanceAccount2 = await tokenInstance.balanceOf(account2);

		var finalist = await governanceInstance.finalist.call();
		assert.equal(finalist , contract2 , 'finalist should match');

		
		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account2});

		var isQuorumReached = await governanceInstance.isQuorumReached.call();
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');

		var finalistSupport = await governanceInstance.finalistSupport.call();
		assert.equal(finalistSupport.toNumber() , balanceAccount2.toNumber() , 'finalistSupport should match');


		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		assert_throw(governanceInstance.decide({from: account3}));

		var isQuorumReached = await governanceInstance.isQuorumReached.call();
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');

		var finalistSupport = await governanceInstance.finalistSupport.call();
		assert.equal(finalistSupport.toNumber() , balanceAccount2.toNumber() , 'finalistSupport should match');


		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account1});

		var isQuorumReached = await governanceInstance.isQuorumReached.call();
		assert.equal(isQuorumReached , true , 'isQuorumReached should match');

		var finalistSupport = await governanceInstance.finalistSupport.call();
		assert.equal(finalistSupport.toNumber() , balanceAccount1.toNumber() + balanceAccount2.toNumber() , 'finalistSupport should match');

	});

	it('governance : decide : should not allow double support the candidate during period' , async () => {
		var account1 = accounts[5];
		var account2 = accounts[6];

		var contract1 = accounts[15];
		var contract2 = accounts[16];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account2 , 100E18 , {from: owner});
		await governanceInstance.choose(contract2 , {from: account2});

		await tokenInstance.mint(account1 , 900E18 , {from: owner});
		await tokenInstance.mint(account2 , 900E18 , {from: owner});

		var balanceAccount1 = await tokenInstance.balanceOf(account1);
		var balanceAccount2 = await tokenInstance.balanceOf(account2);

		var finalist = await governanceInstance.finalist.call();
		assert.equal(finalist , contract2 , 'finalist should match');

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account2});

		var isQuorumReached = await governanceInstance.isQuorumReached.call();
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');

		var finalistSupport = await governanceInstance.finalistSupport.call();
		assert.equal(finalistSupport.toNumber() , balanceAccount2.toNumber() , 'finalistSupport should match');	


		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		assert_throw(governanceInstance.decide({from: account2}));

		var isQuorumReached = await governanceInstance.isQuorumReached.call();
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');

		var finalistSupport = await governanceInstance.finalistSupport.call();
		assert.equal(finalistSupport.toNumber() , balanceAccount2.toNumber() , 'finalistSupport should match');	


		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account1});

		var isQuorumReached = await governanceInstance.isQuorumReached.call();
		assert.equal(isQuorumReached , true , 'isQuorumReached should match');

		var finalistSupport = await governanceInstance.finalistSupport.call();
		assert.equal(finalistSupport.toNumber() , balanceAccount1.toNumber() + balanceAccount2.toNumber() , 'finalistSupport should match');	

	});

	/* CLOSE CANDIDATE */

	it('governance : close : should allow close finalist during close period' , async () => {
		var account1 = accounts[5];
		var account2 = accounts[6];

		var contract1 = accounts[15];
		var contract2 = accounts[16];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account2 , 100E18 , {from: owner});
		await governanceInstance.choose(contract2 , {from: account2});

		var balanceAccount1 = await tokenInstance.balanceOf(account1);
		var balanceAccount2 = await tokenInstance.balanceOf(account2);

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account2});

		var finalist = await governanceInstance.finalist.call();
		assert.equal(finalist , contract2 , 'finalist should be selected');

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 1 , 'cycle should match');

		await governanceInstance.setBlockNumber(166666 * 4, {from: owner});
		await governanceInstance.close({from: owner});

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 0 , 'cycle should match');		
	});

	it('governance : close : should allow close finalist during close period and set params' , async () => {
		var account1 = accounts[5];
		var account2 = accounts[6];

		var contract1 = accounts[15];
		var contract2 = accounts[16];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account2 , 100E18 , {from: owner});
		await governanceInstance.choose(contract2 , {from: account2});

		var balanceAccount1 = await tokenInstance.balanceOf(account1);
		var balanceAccount2 = await tokenInstance.balanceOf(account2);

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account2});

		var finalist = await governanceInstance.finalist.call();
		assert.equal(finalist , contract2 , 'finalist should be selected');

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 1 , 'cycle should match');

		var finalistBefore = await governanceInstance.finalist.call();
		assert.equal(finalistBefore , contract2 , 'finalist should match');

		var finalistWeightBefore = await governanceInstance.finalistWeight.call();
		assert.equal(finalistWeightBefore , balanceAccount2.toNumber() , 'finalistWeight should match');

		var finalistVotesBefore = await governanceInstance.finalistVotes.call();
		assert.equal(finalistVotesBefore , 1 , 'finalistVotes should match');

		var finalistSupportBefore = await governanceInstance.finalistSupport.call();
		assert.equal(finalistSupportBefore , balanceAccount2.toNumber() , 'finalistSupport should match');

		var decided = await governanceInstance.decided.call();
		assert.equal(decided , 0 , 'decided should match');

		var decidedWeight = await governanceInstance.decidedWeight.call();
		assert.equal(decidedWeight , 0 , 'decidedWeight should match');

		var decidedVotes = await governanceInstance.decidedVotes.call();
		assert.equal(decidedVotes , 0 , 'decidedVotes should match');

		var decidedSupport = await governanceInstance.decidedSupport.call();
		assert.equal(decidedSupport , 0 , 'decidedSupport should match');

		await governanceInstance.setBlockNumber(166666 * 4, {from: owner});
		await governanceInstance.close({from: owner});

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 0 , 'cycle should match');	

		var finalistAfter = await governanceInstance.finalist.call();
		assert.equal(finalistAfter , 0 , 'finalist should match');

		var finalistWeightAfter = await governanceInstance.finalistWeight.call();
		assert.equal(finalistWeightAfter , 0 , 'finalistWeight should match');

		var finalistVotesAfter = await governanceInstance.finalistVotes.call();
		assert.equal(finalistVotesAfter , 0 , 'finalistVotes should match');

		var finalistSupportAfter = await governanceInstance.finalistSupport.call();
		assert.equal(finalistSupportAfter , 0 , 'finalistSupport should match');

		var decided = await governanceInstance.decided.call();
		assert.equal(decided , contract2 , 'decided should match');

		var decidedWeight = await governanceInstance.decidedWeight.call();
		assert.equal(decidedWeight , finalistWeightBefore.toNumber() , 'decidedWeight should match');

		var decidedVotes = await governanceInstance.decidedVotes.call();
		assert.equal(decidedVotes , finalistVotesBefore.toNumber() , 'decidedVotes should match');

		var decidedSupport = await governanceInstance.decidedSupport.call();
		assert.equal(decidedSupport , finalistSupportBefore.toNumber() , 'decidedSupport should match');	
	});

	it('governance : close : should throw error if close called before close period' , async () => {
		var account1 = accounts[5];
		var account2 = accounts[6];

		var contract1 = accounts[15];
		var contract2 = accounts[16];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account2 , 100E18 , {from: owner});
		await governanceInstance.choose(contract2 , {from: account2});

		var balanceAccount1 = await tokenInstance.balanceOf(account1);
		var balanceAccount2 = await tokenInstance.balanceOf(account2);

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account2});

		var finalist = await governanceInstance.finalist.call();
		assert.equal(finalist , contract2 , 'finalist should be selected');

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 1 , 'cycle should match');

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		assert_throw(governanceInstance.close({from: owner}));

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 1 , 'cycle should match');		
	});

	it('governance : close : should allow if close called middle close period' , async () => {
		var account1 = accounts[5];
		var account2 = accounts[6];

		var contract1 = accounts[15];
		var contract2 = accounts[16];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account2 , 100E18 , {from: owner});
		await governanceInstance.choose(contract2 , {from: account2});

		var balanceAccount1 = await tokenInstance.balanceOf(account1);
		var balanceAccount2 = await tokenInstance.balanceOf(account2);

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account2});

		var finalist = await governanceInstance.finalist.call();
		assert.equal(finalist , contract2 , 'finalist should be selected');

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 1 , 'cycle should match');

		await governanceInstance.setBlockNumber(166666 * 4, {from: owner});
		await governanceInstance.close({from: owner});

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 0 , 'cycle should match');		
	});

	it('governance : close : should throw error if close called after close period' , async () => {
		var account1 = accounts[5];
		var account2 = accounts[6];

		var contract1 = accounts[15];
		var contract2 = accounts[16];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account2 , 100E18 , {from: owner});
		await governanceInstance.choose(contract2 , {from: account2});

		var balanceAccount1 = await tokenInstance.balanceOf(account1);
		var balanceAccount2 = await tokenInstance.balanceOf(account2);

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account2});

		var finalist = await governanceInstance.finalist.call();
		assert.equal(finalist , contract2 , 'finalist should be selected');

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 1 , 'cycle should match');

		await governanceInstance.setBlockNumber(166666 * 7, {from: owner});
		assert_throw(governanceInstance.close({from: owner}));

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 1 , 'cycle should match');		
	});

	it('governance : close : should allow close finalist with quorum reached' , async () => {
		var account1 = accounts[5];
		var account2 = accounts[6];

		var contract1 = accounts[15];
		var contract2 = accounts[16];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account2 , 100E18 , {from: owner});
		await governanceInstance.choose(contract2 , {from: account2});

		await tokenInstance.mint(account1 , 900E18 , {from: owner});
		await tokenInstance.mint(account2 , 900E18 , {from: owner});

		var balanceAccount1 = await tokenInstance.balanceOf(account1);
		var balanceAccount2 = await tokenInstance.balanceOf(account2);

		var balanceAccount1 = await tokenInstance.balanceOf(account1);
		var balanceAccount2 = await tokenInstance.balanceOf(account2);

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account2});

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account1});

		var finalist = await governanceInstance.finalist.call();
		assert.equal(finalist , contract2 , 'finalist should be selected');

		var isQuorumReached = await governanceInstance.isQuorumReached.call();
		assert.equal(isQuorumReached , true , 'isQuorumReached should match');

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 1 , 'cycle should match');

		await governanceInstance.setBlockNumber(166666 * 4, {from: owner});
		await governanceInstance.close({from: owner});

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 0 , 'cycle should match');	
	});

	it('governance : close : should allow close finalist without quorum reached' , async () => {
		var account1 = accounts[5];
		var account2 = accounts[6];

		var contract1 = accounts[15];
		var contract2 = accounts[16];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account2 , 100E18 , {from: owner});
		await governanceInstance.choose(contract2 , {from: account2});

		await tokenInstance.mint(account1 , 900E18 , {from: owner});
		await tokenInstance.mint(account2 , 900E18 , {from: owner});

		var balanceAccount1 = await tokenInstance.balanceOf(account1);
		var balanceAccount2 = await tokenInstance.balanceOf(account2);

		var balanceAccount1 = await tokenInstance.balanceOf(account1);
		var balanceAccount2 = await tokenInstance.balanceOf(account2);

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account2});

		var finalist = await governanceInstance.finalist.call();
		assert.equal(finalist , contract2 , 'finalist should be selected');

		var isQuorumReached = await governanceInstance.isQuorumReached.call();
		assert.equal(isQuorumReached , false , 'isQuorumReached should match');

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 1 , 'cycle should match');

		await governanceInstance.setBlockNumber(166666 * 4, {from: owner});
		await governanceInstance.close({from: owner});

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 0 , 'cycle should match');	
	});

	it('governance : close : should allow close finalist and reset the variables' , async () => {
		var account1 = accounts[5];
		var account2 = accounts[6];

		var contract1 = accounts[15];
		var contract2 = accounts[16];

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account2 , 100E18 , {from: owner});
		await governanceInstance.choose(contract2 , {from: account2});

		var balanceAccount1 = await tokenInstance.balanceOf(account1);
		var balanceAccount2 = await tokenInstance.balanceOf(account2);

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account2});

		var finalist = await governanceInstance.finalist.call();
		assert.equal(finalist , contract2 , 'finalist should be selected');

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 1 , 'cycle should match');

		var finalistBefore = await governanceInstance.finalist.call();
		assert.equal(finalistBefore , contract2 , 'finalist should match');

		var finalistWeightBefore = await governanceInstance.finalistWeight.call();
		assert.equal(finalistWeightBefore , balanceAccount2.toNumber() , 'finalistWeight should match');

		var finalistVotesBefore = await governanceInstance.finalistVotes.call();
		assert.equal(finalistVotesBefore , 1 , 'finalistVotes should match');

		var finalistSupportBefore = await governanceInstance.finalistSupport.call();
		assert.equal(finalistSupportBefore , balanceAccount2.toNumber() , 'finalistSupport should match');

		var decided = await governanceInstance.decided.call();
		assert.equal(decided , 0 , 'decided should match');

		var decidedWeight = await governanceInstance.decidedWeight.call();
		assert.equal(decidedWeight , 0 , 'decidedWeight should match');

		var decidedVotes = await governanceInstance.decidedVotes.call();
		assert.equal(decidedVotes , 0 , 'decidedVotes should match');

		var decidedSupport = await governanceInstance.decidedSupport.call();
		assert.equal(decidedSupport , 0 , 'decidedSupport should match');

		await governanceInstance.setBlockNumber(166666 * 4, {from: owner});
		await governanceInstance.close({from: owner});

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 0 , 'cycle should match');	

		var finalistAfter = await governanceInstance.finalist.call();
		assert.equal(finalistAfter , 0 , 'finalist should match');

		var finalistWeightAfter = await governanceInstance.finalistWeight.call();
		assert.equal(finalistWeightAfter , 0 , 'finalistWeight should match');

		var finalistVotesAfter = await governanceInstance.finalistVotes.call();
		assert.equal(finalistVotesAfter , 0 , 'finalistVotes should match');

		var finalistSupportAfter = await governanceInstance.finalistSupport.call();
		assert.equal(finalistSupportAfter , 0 , 'finalistSupport should match');

		var decided = await governanceInstance.decided.call();
		assert.equal(decided , contract2 , 'decided should match');

		var decidedWeight = await governanceInstance.decidedWeight.call();
		assert.equal(decidedWeight , finalistWeightBefore.toNumber() , 'decidedWeight should match');

		var decidedVotes = await governanceInstance.decidedVotes.call();
		assert.equal(decidedVotes , finalistVotesBefore.toNumber() , 'decidedVotes should match');

		var decidedSupport = await governanceInstance.decidedSupport.call();
		assert.equal(decidedSupport , finalistSupportBefore.toNumber() , 'decidedSupport should match');	
	});

	it('governance : close : should rotate the cycle properly' , async () => {
		var account1 = accounts[5];
		var account2 = accounts[6];

		var contract1 = accounts[15];
		var contract2 = accounts[16];

		// Cycle 1 - 1 DM
		
		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account2 , 100E18 , {from: owner});
		await governanceInstance.choose(contract2 , {from: account2});


		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account2});

		var finalist = await governanceInstance.finalist.call();
		assert.equal(finalist , contract2 , 'finalist should be selected');

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 1 , 'cycle should match');

		var cycleCounter = await governanceInstance.cycleCounter.call();
		assert.equal(cycleCounter.toNumber() , 2 , 'cycleCounter should match');

		await governanceInstance.setBlockNumber(166666 * 4, {from: owner});
		await governanceInstance.close({from: owner});

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 0 , 'cycle should match');		

		var cycleCounter = await governanceInstance.cycleCounter.call();
		assert.equal(cycleCounter.toNumber() , 3 , 'cycleCounter should match');

		var candidateCount = await governanceInstance.candidateCount.call();
		assert.equal(candidateCount , 0 , 'candidate count should match');

		// Cycle 2 - 0 GOV

		var candidateList = await governanceInstance.candidateList.call(contract1);
		assert.equal(candidateList , false , 'candidateList count should match');

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account2 , 100E18 , {from: owner});
		await governanceInstance.choose(contract2 , {from: account2});

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account2});

		var finalist = await governanceInstance.finalist.call();
		assert.equal(finalist , contract2 , 'finalist should be selected');

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 0 , 'cycle should match');

		var cycleCounter = await governanceInstance.cycleCounter.call();
		assert.equal(cycleCounter.toNumber() , 3 , 'cycleCounter should match');

		var candidateList = await governanceInstance.candidateList.call(contract1);
		assert.equal(candidateList , true , 'candidateList count should match');

		var candidateCount = await governanceInstance.candidateCount.call();
		assert.equal(candidateCount.toNumber() , 2 , 'candidateCount count should match');

		await governanceInstance.setBlockNumber(166666 * 4, {from: owner});
		await governanceInstance.close({from: owner});

		var candidateCount = await governanceInstance.candidateCount.call();
		assert.equal(candidateCount.toNumber() , 0 , 'candidateCount count should match');
		
		var candidateList = await governanceInstance.candidateList.call(contract1);
		assert.equal(candidateList , false , 'candidateList count should match');

		
		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 1 , 'cycle should match');	

		var cycleCounter = await governanceInstance.cycleCounter.call();
		assert.equal(cycleCounter.toNumber() , 4 , 'cycleCounter should match');

		var candidateCount = await governanceInstance.candidateCount.call();
		assert.equal(candidateCount , 0 , 'candidate count should match');

		// Cycle 3 - 1 DM

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		var stage = await governanceInstance.stage.call();
		assert.equal(stage , 1 , 'stage count should match');

		var candidateList = await governanceInstance.candidateList.call(contract1);
		assert.equal(candidateList , false , 'candidateList count should match');
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account2 , 100E18 , {from: owner});
		await governanceInstance.choose(contract2 , {from: account2});

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account2});

		var finalist = await governanceInstance.finalist.call();
		assert.equal(finalist , contract2 , 'finalist should be selected');

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 1 , 'cycle should match');

		var cycleCounter = await governanceInstance.cycleCounter.call();
		assert.equal(cycleCounter.toNumber() , 4 , 'cycleCounter should match');

		await governanceInstance.setBlockNumber(166666 * 4, {from: owner});
		await governanceInstance.close({from: owner});

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 1 , 'cycle should match');

		var cycleCounter = await governanceInstance.cycleCounter.call();
		assert.equal(cycleCounter.toNumber() , 5 , 'cycleCounter should match');	

		// Cycle 4 - 1 DM

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		var stage = await governanceInstance.stage.call();
		assert.equal(stage , 1 , 'stage count should match');

		var candidateList = await governanceInstance.candidateList.call(contract1);
		assert.equal(candidateList , false , 'candidateList count should match');
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account2 , 100E18 , {from: owner});
		await governanceInstance.choose(contract2 , {from: account2});

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account2});

		var finalist = await governanceInstance.finalist.call();
		assert.equal(finalist , contract2 , 'finalist should be selected');

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 1 , 'cycle should match');

		var cycleCounter = await governanceInstance.cycleCounter.call();
		assert.equal(cycleCounter.toNumber() , 5 , 'cycleCounter should match');

		await governanceInstance.setBlockNumber(166666 * 4, {from: owner});
		await governanceInstance.close({from: owner});

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 0 , 'cycle should match');

		var cycleCounter = await governanceInstance.cycleCounter.call();
		assert.equal(cycleCounter.toNumber() , 6 , 'cycleCounter should match');

		// Cycle 5 - 0 GOV

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		var stage = await governanceInstance.stage.call();
		assert.equal(stage , 1 , 'stage count should match');

		var candidateList = await governanceInstance.candidateList.call(contract1);
		assert.equal(candidateList , false , 'candidateList count should match');
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account2 , 100E18 , {from: owner});
		await governanceInstance.choose(contract2 , {from: account2});

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account2});

		var finalist = await governanceInstance.finalist.call();
		assert.equal(finalist , contract2 , 'finalist should be selected');

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 0 , 'cycle should match');

		var cycleCounter = await governanceInstance.cycleCounter.call();
		assert.equal(cycleCounter.toNumber() , 6 , 'cycleCounter should match');

		await governanceInstance.setBlockNumber(166666 * 4, {from: owner});
		await governanceInstance.close({from: owner});

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 1 , 'cycle should match');

		var cycleCounter = await governanceInstance.cycleCounter.call();
		assert.equal(cycleCounter.toNumber() , 7 , 'cycleCounter should match');

		// Cycle 6 - 1 DM

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		var stage = await governanceInstance.stage.call();
		assert.equal(stage , 1 , 'stage count should match');

		var candidateList = await governanceInstance.candidateList.call(contract1);
		assert.equal(candidateList , false , 'candidateList count should match');
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account2 , 100E18 , {from: owner});
		await governanceInstance.choose(contract2 , {from: account2});

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account2});

		var finalist = await governanceInstance.finalist.call();
		assert.equal(finalist , contract2 , 'finalist should be selected');

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 1 , 'cycle should match');

		var cycleCounter = await governanceInstance.cycleCounter.call();
		assert.equal(cycleCounter.toNumber() , 7 , 'cycleCounter should match');

		await governanceInstance.setBlockNumber(166666 * 4, {from: owner});
		await governanceInstance.close({from: owner});

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 1 , 'cycle should match');

		var cycleCounter = await governanceInstance.cycleCounter.call();
		assert.equal(cycleCounter.toNumber() , 8 , 'cycleCounter should match');	

		// Cycle 7 - 1 DM

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		var stage = await governanceInstance.stage.call();
		assert.equal(stage , 1 , 'stage count should match');

		var candidateList = await governanceInstance.candidateList.call(contract1);
		assert.equal(candidateList , false , 'candidateList count should match');
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account2 , 100E18 , {from: owner});
		await governanceInstance.choose(contract2 , {from: account2});

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account2});

		var finalist = await governanceInstance.finalist.call();
		assert.equal(finalist , contract2 , 'finalist should be selected');

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 1 , 'cycle should match');

		var cycleCounter = await governanceInstance.cycleCounter.call();
		assert.equal(cycleCounter.toNumber() , 8 , 'cycleCounter should match');

		await governanceInstance.setBlockNumber(166666 * 4, {from: owner});
		await governanceInstance.close({from: owner});

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 0 , 'cycle should match');

		var cycleCounter = await governanceInstance.cycleCounter.call();
		assert.equal(cycleCounter.toNumber() , 9 , 'cycleCounter should match');	

		// Cycle 8 - 0 GOV

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		var stage = await governanceInstance.stage.call();
		assert.equal(stage , 1 , 'stage count should match');

		var candidateList = await governanceInstance.candidateList.call(contract1);
		assert.equal(candidateList , false , 'candidateList count should match');
		await governanceInstance.submit(contract1 , {from: contract1});

		await governanceInstance.setBlockNumber(166666 , {from: owner});
		await governanceInstance.submit(contract2 , {from: contract2});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account1 , 10E18 , {from: owner});
		await governanceInstance.choose(contract1 , {from: account1});

		await governanceInstance.setBlockNumber(166666 * 2, {from: owner});
		await tokenInstance.transfer(account2 , 100E18 , {from: owner});
		await governanceInstance.choose(contract2 , {from: account2});

		await governanceInstance.setBlockNumber(166666 * 3, {from: owner});
		await governanceInstance.decide({from: account2});

		var finalist = await governanceInstance.finalist.call();
		assert.equal(finalist , contract2 , 'finalist should be selected');

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 0 , 'cycle should match');

		var cycleCounter = await governanceInstance.cycleCounter.call();
		assert.equal(cycleCounter.toNumber() , 9 , 'cycleCounter should match');

		await governanceInstance.setBlockNumber(166666 * 4, {from: owner});
		await governanceInstance.close({from: owner});

		var cycle = await governanceInstance.cycle.call();
		assert.equal(cycle.toNumber() , 1 , 'cycle should match');

		var cycleCounter = await governanceInstance.cycleCounter.call();
		assert.equal(cycleCounter.toNumber() , 10 , 'cycleCounter should match');
	});
});