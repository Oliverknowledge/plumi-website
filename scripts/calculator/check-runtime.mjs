import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const html = fs.readFileSync(`${root}public/calculator/index.html`, 'utf8');
const keys = JSON.parse(fs.readFileSync(`${root}public/calculator/data/CY234/keylog.json`, 'utf8'));

// Every visible EX button must have exactly one firmware key mapping.
const keypad = html.split('<div id="keypadCY">')[1].split('<div id="keypadESP2"')[0];
const regions = [...keypad.matchAll(/data-ki="(\d+)" data-ko="(\d+)"/g)].map(m => `${m[1]},${m[2]}`);
assert.equal(new Set(regions).size, regions.length, 'Duplicate key regions');
assert.deepEqual(new Set(regions), new Set(Object.keys(keys)), 'Unmapped or missing EX keys');

// Exercise the shipped keyboard handler, without booting or substituting the ROM.
const source = html.slice(html.indexOf('  const keyboardMap = {}'), html.indexOf('  const modelSwitchCallback ='));
const pressed = [];
const logKeyToKiKo = Object.fromEntries(Object.entries(keys).map(([pair, value]) => [value[2], pair.split(',').map(Number)]));
const context = { isEditing: false, logKeyToKiKo,
  sim: { SetKey: (ki, ko) => pressed.push(`${ki},${ko}`) },
  keypadEl: { querySelector: () => null }, keypad: {},
};
vm.createContext(context);
vm.runInContext(source, context);
let blurred = false;
const button = { getAttribute: name => name === 'role' ? 'button' : null, blur: () => { blurred = true; } };
function key(key, target = {}, extra = {}) {
  let prevented = false;
  context.onkeydown({ key, type: 'keydown', target, preventDefault: () => { prevented = true; }, ...extra });
  return prevented;
}
key('1', button);
assert.equal(pressed.at(-1), '1,1', 'Typing after a key click must work');
assert.ok(blurred, 'Typing must leave key-button activation mode');
key('+'); key('2'); key('Enter');
assert.deepEqual(pressed, ['1,1', '1,8', '1,2', '1,64']);
const before = pressed.length;
assert.equal(key('Tab'), false, 'Tab must remain browser navigation');
assert.equal(key(' '), false, 'Space must not clear the calculation');
key('r', {}, { ctrlKey: true });
key('c', {}, { metaKey: true });
assert.equal(pressed.length, before, 'Browser shortcuts must not press calculator keys');

// ON must wake the firmware directly: when powered off, no ordinary keys are
// scanned. Test the actual worker method with only its hardware reset stubbed.
const worker = fs.readFileSync(`${root}public/calculator/lib/simwrapper.js`, 'utf8');
const setKey = worker.slice(worker.indexOf('\tSetKey(ki, ko) {'), worker.indexOf('\n\tSetHardwareKey'));
const HardwareKeys = vm.runInNewContext(`(class { ${setKey} })`, { _verbose: false, IM_KIKO_ON_KI: 0, IM_KIKO_ON_KO: 0 });
const hardware = new HardwareKeys();
let wakes = 0;
hardware._kikoQueue = [];
hardware._OnKey = () => { wakes++; };
hardware._KeyLogPush = () => {};
hardware.SetKey(0, 0);
assert.equal(wakes, 1, 'ON must wake a powered-off calculator without the scan queue');
assert.equal(hardware._kikoQueue.length, 0, 'ON must not wait in the ordinary key queue');
hardware.SetKey(1, 1);
assert.equal(hardware._kikoQueue.length, 1, 'Ordinary keys must still be queued');

// Busy calculations must retain queued typing. AC cancels earlier input, but
// must preserve the new calculation queued after the cancellation key.
const acBreak = worker.slice(worker.indexOf('\t_AcBreak() {'), worker.indexOf('\n\t_AcBreakChecking'));
const BusyKeys = vm.runInNewContext(`(class { ${acBreak} })`, {IM_KIKO_AC_KI:4, IM_KIKO_AC_KO:16});
const busy = new BusyKeys();
busy._kikoQueue = [[1,1,0],[1,8,0],[1,2,0]];
assert.equal(busy._AcBreak(), false);
assert.equal(busy._kikoQueue.length,3,'Busy polling must not consume normal keys');
busy._kikoQueue = [[1,1,0],[4,16,0],[1,2,0],[1,64,0]];
assert.equal(busy._AcBreak(),true);
assert.deepEqual(busy._kikoQueue,[[1,2,0],[1,64,0]],'Typing after AC must survive cancellation');

const getKey = worker.slice(worker.indexOf('\t_GetKey() {'),worker.indexOf('\n\t_KeyBuffClear'));
const WakeKeys = vm.runInNewContext(`(class { ${getKey} })`);
const wake = new WakeKeys();
wake._wakePending=true;
wake._kikoQueue=[[1,1,0]];
wake.GetDisplayImageData=()=>({data:new Uint8Array(4)});
assert.equal(wake._GetKey(),null,'Booting must hold queued input');
assert.equal(wake._kikoQueue.length,1);
wake.GetDisplayImageData=()=>({data:new Uint8Array([0,0,0,255])});
assert.deepEqual(wake._GetKey(),[1,1,0],'Restored display must release queued input');
assert.equal(wake._wakePending,false);
console.log(`Passed: all ${regions.length} EX key regions mapped; keyboard, browser shortcuts, ON wake buffering and busy-input cancellation regressions.`);
