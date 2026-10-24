import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('the card body masks two pixels of the clipped artwork on desktop and mobile',()=>{
  assert.match(html,/\.body\s*\{\s*--art-overlap:34px/);
  assert.match(html,/margin-top:calc\(0px - var\(--art-overlap\)\)/);
  assert.match(html,/background:linear-gradient\(to bottom, transparent calc\(var\(--art-overlap\) - 2px\), var\(--surf\) calc\(var\(--art-overlap\) - 2px\)\)/);
  assert.match(html,/\.body\s*\{\s*--art-overlap:12px/);
  assert.match(html,/a\.card:hover \.art img\s*\{\s*transform:scale\(1\.04\)/);
});
