// Exports
const timeHelper = {};

async function increaseTime(time) {
  return new Promise((resolve, reject) => {
    web3.currentProvider.sendAsync({
      jsonrpc: "2.0",
      method: "evm_increaseTime",
      params: [time], // 86400 is number of seconds in one day
      id: new Date().getTime()
    }, (err, result) => {
      if (err) {
        return reject(err)
      }
      return resolve(result)
    });
  })
};

async function mineNewBlock() {
  return new Promise((resolve, reject) => {
    web3.currentProvider.sendAsync({jsonrpc: "2.0", method: "evm_mine", params: [], id: 0},
      (err, result) => {
        if (err) {
          return reject(err)
        }
        return resolve(result)
      });
  })
};

/**
* Increases ether network time by mining new blocks
* Only sets future time, can't go back
*
* @param time - new network time in seconds
*/
timeHelper.setTestRPCTime = async function(newtime) {
  const currentTime = web3.eth.getBlock(web3.eth.blockNumber).timestamp;
  if (newtime > currentTime + 3600) {
    const timeDiff = newtime - currentTime;
    await increaseTime(timeDiff);
    await mineNewBlock();
  }
};

timeHelper.getCurrentTime = function() {
  return web3.eth.getBlock(web3.eth.blockNumber).timestamp;
}

module.exports = timeHelper;
