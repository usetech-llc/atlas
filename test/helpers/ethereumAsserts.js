// Exports
const ethereumAsserts = {};

ethereumAsserts.expectRevertAsync = async function(testedFunction, message) {

    /**
     *   vpredtechenskaya 22.02.2018  implementation was changed
     */
    const txRevertRegExp = /VM Exception while processing transaction: revert|not a number/; // TODO parametrize function

    let f = () => {};
    try {
        await testedFunction();
    } catch(e) {
        f = () => {throw e};
    } finally {
        assert.throws(f, txRevertRegExp);
    }
};

module.exports = ethereumAsserts;
