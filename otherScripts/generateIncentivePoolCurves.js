const fs = require("fs");

const outputFile = "./../contracts/IncentiveCurveTable.sol";
const outputCsv = "./IncentiveCurveTable.csv";

const disclaimer = `////////////////////////////////////////////////////////////
// This is automatically generated file, please do not edit
//
`;

const curveCap = 50000;
const dataPoints = 51;
const step = 10 * 365.25*24*60*60 / (dataPoints - 1); // time step
const tokenCap = 1.62e9;

//////////////////////////////////////////////////////////////////////
// Exponential curve parameters

const base = 1.1;
const exponentCoeff = 0.0000002;

//////////////////////////////////////////////////////////////////////
// Hyperbolic curve parameters

const alpha = 6;
const hyperExponent = 25;
const skipPoints = 30; // Points to skip in the beginning


/**
* Get exponential curve value for timestamp in seconds (from contract deployment)
*
* Excel formula: (1-POWER($K$15, -C1*$K$13/1000))*$K$14
*
* @param timestamp - timestamp in seconds
*/
function getExponentialCurve(timestamp) {
    return (1 - Math.pow(base, -1 * timestamp * exponentCoeff)) * curveCap;
}

/**
* Get hyperbolic curve value for timestamp in seconds (from contract deployment)
*
* Excel formula: = ALPHA*x - POWER(POWER(ALPHA*x, EXPONENT) + POWER(CAP,EXPONENT), 1/EXPONENT) + CAP
*
* @param timestamp - timestamp in seconds
*/
function getHyperbolicCurve(timestamp) {
    if (timestamp == 0) return 0;
    return curveCap * (alpha * timestamp - Math.pow(Math.pow(alpha * timestamp, hyperExponent) + Math.pow(tokenCap, hyperExponent), 1/hyperExponent) + tokenCap) / tokenCap;
}

fs.writeFileSync(outputFile, `${disclaimer}\n`);
fs.writeFileSync(outputCsv, "");

fs.appendFileSync(outputFile, `pragma solidity ^0.4.18;\n\n`);

fs.appendFileSync(outputFile, `contract IncentiveCurveTable {\n`);
fs.appendFileSync(outputFile, `    uint16[] public curveData;\n`);
fs.appendFileSync(outputFile, `    uint256 public dataLen;\n`);
fs.appendFileSync(outputFile, `    uint256 public timeStep;\n`);
fs.appendFileSync(outputFile, `    uint256 public curveCap;\n`);
fs.appendFileSync(outputFile, `    uint256 public skipPoints;\n`);
fs.appendFileSync(outputFile, `    function IncentiveCurveTable() public {\n`);
fs.appendFileSync(outputFile, `        dataLen = ${dataPoints};\n`);
fs.appendFileSync(outputFile, `        timeStep = ${step};\n`);
fs.appendFileSync(outputFile, `        curveCap = ${curveCap};\n`);
fs.appendFileSync(outputFile, `        skipPoints = ${skipPoints};\n`);

var currentTimestamp = 0;
for (var i=0; i<dataPoints; i++) {
    var roundedValue = parseInt(getHyperbolicCurve(currentTimestamp));
    if (i==0 || i>skipPoints) {
        fs.appendFileSync(outputFile, `        curveData.push(${roundedValue});\n`);
        fs.appendFileSync(outputCsv, `${roundedValue}\n`);
    }
    currentTimestamp += step;
}

fs.appendFileSync(outputFile, `    }\n`);
fs.appendFileSync(outputFile, `}\n`);
