import assert from 'node:assert/strict';
import { bootFirmware } from './firmware-harness.mjs';

const runtime=await bootFirmware();
const literal=value=>[...String(value)].flatMap((c,i)=>c==='-'?[i===0?'(-)':'-']:[c]);
const resultPixels=frame=>Buffer.from(frame.data).subarray(frame.width*38*4);
let passed=0;
const failures=[];
async function check(name, expression, expected, setup=[]) {
  try {
    if(setup.length) await runtime.keys(setup);
    const actual=await runtime.keys(['AC',...expression,'=']);
    const reference=await runtime.keys(['AC',...(Array.isArray(expected)?expected:literal(expected)),'=']);
    const image=resultPixels(actual);
    assert.ok(image.some((value,index)=>index%4===3&&value>0),'Actual result region is blank');
    assert.ok(image.equals(resultPixels(reference)),`Displayed result differs from ${expected}`);
    passed++;
    console.log(`PASS ${name}`);
  } catch(error) { failures.push(name); console.error(`FAIL ${name}: ${error.message}`); }
}
try {
  console.log(`Actual firmware: ${runtime.sim.RomVersion()}`);
  for(let i=1;i<=12;i++) {
    const a=i*7,b=i+3;
    await check(`integer addition ${a}+${b}`,[...literal(a),'+',...literal(b)],a+b);
    await check(`integer product ${a}×${b}`,[...literal(a),'*',...literal(b)],a*b);
  }
  await check('precedence 2+3×4',['2','+','3','*','4'],14);
  await check('parentheses (2+3)×4',['(','2','+','3',')','*','4'],20);
  await check('negative arithmetic',['(-)','5','+','2'],-3);
  await check('negative product',['(-)','5','*','(-)','7'],35);
  await check('decimal arithmetic',['0','.','1','+','0','.','2'],0.3);
  await check('exact fractions',['1','/','3','+','1','/','6'],['1','/','2']);
  await check('fraction template',['d/c','1','Down','3','Right','+','d/c','1','Down','6'],['1','/','2']);
  await check('square root',['Square Root','1','4','4'],12);
  await check('square',['1','2','x^2'],144);
  await check('power',['2','^','1','0'],1024);
  await check('cube root',['SHIFT','Square Root','2','7'],3);
  await check('sin 30 degrees',['sin','3','0'],['1','/','2']);
  await check('cos 60 degrees',['cos','6','0'],['1','/','2']);
  await check('tan 45 degrees',['tan','4','5'],1);
  await check('inverse sine',['SHIFT','sin','0','.','5'],30);
  await check('inverse cosine',['SHIFT','cos','0','.','5'],60);
  await check('inverse tangent',['SHIFT','tan','1'],45);
  await check('natural log',['ln','1'],0);
  await check('exponential',['SHIFT','ln','0'],1);
  await check('factorial',['5','SHIFT','x^-1'],120);
  await check('combinations',['5','SHIFT','/','2'],10);
  await check('permutations',['5','SHIFT','*','2'],20);
  await check('delete editing',['1','2','DEL','3'],13);
  await runtime.keys(['AC','6','*','7','=']);
  await check('answer recall',['Ans','+','8'],50);
  await runtime.keys(['AC','2','3','STO','(-)']);
  await check('ALPHA variable recall',['ALPHA','(-)'],23);
  await check('radian sine',['sin','SHIFT','*10^x','/','2'],1,['SHIFT','MENU','2','2']);
  await runtime.keys(['SHIFT','MENU','2','1']);
  await check('complex square root',['Square Root','(-)','1'],['ENG'],['MENU','2']);
  await runtime.keys(['MENU','1']);
  // Submit the full expression immediately after ON, without waiting for the
  // boot display. This reproduces the lost-input regression as well as wake.
  for(let i=0;i<5;i++) {
    await runtime.keys(['SHIFT','AC']);
    runtime.sim.SetKey(0,0); // ON; intentionally do not wait for boot/settle.
    await check(`immediate OFF/ON cycle ${i+1}`,['8','*','7'],56);
  }
  console.log(`\n${passed} passed; ${failures.length} failed.`);
  if(failures.length) { console.error(failures.join('\n')); process.exitCode=1; }
} finally { runtime.close(); }
