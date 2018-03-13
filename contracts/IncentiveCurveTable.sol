////////////////////////////////////////////////////////////
// This is automatically generated file, please do not edit
//

pragma solidity ^0.4.18;

contract IncentiveCurveTable {
    uint16[] public curveData;
    uint256 public dataLen;
    uint256 public timeStep;
    uint256 public curveCap;
    uint256 public skipPoints;
    function IncentiveCurveTable() public {
        dataLen = 51;
        timeStep = 6311520;
        curveCap = 50000;
        skipPoints = 30;
        curveData.push(0);
        curveData.push(36232);
        curveData.push(37400);
        curveData.push(38567);
        curveData.push(39732);
        curveData.push(40894);
        curveData.push(42050);
        curveData.push(43193);
        curveData.push(44313);
        curveData.push(45393);
        curveData.push(46408);
        curveData.push(47323);
        curveData.push(48100);
        curveData.push(48715);
        curveData.push(49166);
        curveData.push(49474);
        curveData.push(49674);
        curveData.push(49799);
        curveData.push(49877);
        curveData.push(49924);
        curveData.push(49953);
    }
}
