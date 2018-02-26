const fs = require("fs");

const outputFile = "./../contracts/IncentiveCurveTable.sol";
const outputCsv = "./IncentiveCurveTable.csv";

const disclaimer = `////////////////////////////////////////////////////////////
// This is automatically generated file, please do not edit
//
`;

const base = 1.1;
const exponentCoeff = 0.0000002;
const curveCap = 50000;
const step = 365.25*24*60*60/10; // 10 points per year
const dataPoints = 101;

/**
* Get curve value for timestamp in seconds (from contract deployment)
*
* Excel formula: (1-POWER($K$15, -C1*$K$13/1000))*$K$14
*
* @param timestamp - timestamp in seconds
*/
function getCurve(timestamp) {
    return (1 - Math.pow(base, -1 * timestamp * exponentCoeff)) * curveCap;
}

fs.writeFileSync(outputFile, `${disclaimer}\n`);
fs.writeFileSync(outputCsv, "");

fs.appendFileSync(outputFile, `pragma solidity ^0.4.18;\n\n`);

fs.appendFileSync(outputFile, `contract IncentiveCurveTable {\n`);
fs.appendFileSync(outputFile, `    uint16[] public curveData;\n`);
fs.appendFileSync(outputFile, `    uint256 public dataLen;\n`);
fs.appendFileSync(outputFile, `    uint256 public timeStep;\n`);
fs.appendFileSync(outputFile, `    uint256 public curveCap;\n`);
fs.appendFileSync(outputFile, `    function IncentiveCurveTable() public {\n`);
fs.appendFileSync(outputFile, `        dataLen = ${dataPoints};\n`);
fs.appendFileSync(outputFile, `        timeStep = ${step};\n`);
fs.appendFileSync(outputFile, `        curveCap = ${curveCap};\n`);

var currentTimestamp = 0;
for (var i=0; i<dataPoints; i++) {
    var roundedValue = parseInt(getCurve(currentTimestamp));
    fs.appendFileSync(outputFile, `        curveData.push(${roundedValue});\n`);
    fs.appendFileSync(outputCsv, `${roundedValue}\n`);
    currentTimestamp += step;
}

fs.appendFileSync(outputFile, `    }\n`);
fs.appendFileSync(outputFile, `}\n`);
