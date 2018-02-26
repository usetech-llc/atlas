// Exports
const ethereumAsserts = {};

ethereumAsserts.expectRevertAsync = async function(testedFunction, message) {
    try {
        await testedFunction();
    } catch (error) {
        const invalidOptcode = error.message.search('not a number') >= 0;
        const revert = error.message.search('VM Exception while processing transaction: revert') >= 0;
        assert(invalidOptcode || revert, 'Expected throw, got <' + error + '> instead');
        return;
    }

    assert.fail(message);
};

module.exports = ethereumAsserts;
