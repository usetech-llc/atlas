//import expectThrow from '../helpers/expectThrow';

const AccessCoin = artifacts.require('../contracts/AccessCoin.sol');
const Relay = artifacts.require('../contracts/Relay.sol');

var g = 0x009beAE06B0c0C536ad1eA43D6f61DCCf0748B1f;
var ip = 0xB1EFca62C555b49E67363B48aE5b8Af3C7E3e656;

contract('Relay', function () {
  let relay;
  let token;

  beforeEach(async function () {
    relay = await Relay.new(g, ip);
    token = await AccessCoin.new();
  });

  describe('creating the relay', function () {
  	it('return correct Governance, IP, and DM addresses after initialization', async function () {
	    let governance = await relay.governance();
	    let incentive_pool = await relay.incentive_pool();
	    let decision_module = await relay.decision_module();

	    assert.equal(governance, g);
	    assert.equal(incentive_pool = ip);
	    assert.equal(decision_module, 0x00);
	});
  });


  describe('swapping addresses', function () {
  	it('throw error when unauthorized account calls setGovernance', async function () {
    	//await expectThrow(relay.setGovernance(0x715a70a7c7d76acc8d5874862e381c1940c19cce);
    });

	it('return correct governance address after changed by current governance account', async function () {
	    
	});

	it('throw error when governance address passes invalid address', async function () {

    });


  	it('throw error when unauthorized account calls setDecisionModule', async function () {
		//await expectThrow(relay.setDecisionModule(0x715a70a7c7d76acc8d5874862e381c1940c19cce);
	});

	it('return correct decision module address after changed by current governance account', async function () {
	    
	});

  	it('throw error when governance address passes invalid address', async function () {

    });

  });

  describe('forwarding calls', function () {
  	it('return true when calls are forwarded to governance address', async function () {
	    
	});

	it('return true when calls are forwarded to decision module address', async function () {
	    
	});
  });

  describe('returning data', function () {
  	it('return correct data from governance getters', async function () {
	    
	});

  	it('throw error when governance contract returns errors', async function () {
	    
	});

	it('return correct data from decision module getters', async function () {
	    
	});

	it('throw error when decision_module contract returns errors', async function () {
	    
	});
  });

/*

INITIALIZATION
	return correct governance address
	return correct incentive pool address
	return 0x0 for the decision module address

CHANGING ADDRESSES
	throw error when unauthorized account calls setGovernance
	throw error when address passed is not valid
	return correct governance address after changed by current governance account

	throw error when unauthorized account calls setDecisionModule
	throw error when address passed is not valid
	return correct decision module address after changed by current governance account

FORWARDING CALLS
	return true when calls are forwarded to governance address
	return true when calls are forwarded to decision module address

*RETURNING DATA
	*return correct data from governance getters
	throw error when governance contract returns errors
	*return correct data from decision module getters
	throw error when decision_module contract returns errors

*/
