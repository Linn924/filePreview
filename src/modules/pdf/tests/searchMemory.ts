import assert from 'node:assert/strict';
import {shallowRef} from 'vue';
import type {PDFDocumentProxy} from 'pdfjs-dist';
import {usePdfSearch} from '../useSearch';

const pdf={numPages:120,getPage:async()=>({getTextContent:async()=>({items:[{str:'needle '.repeat(20)}]})})} as unknown as PDFDocumentProxy;
const search=usePdfSearch(shallowRef(pdf));
await search.run('needle');
assert.equal(search.hits.value.length,2400,'each hit must remain reachable');
assert.ok(search.cacheSize()<=32,'search text cache must remain bounded');
assert.equal(search.searching.value,false);
await search.run('missing');
assert.equal(search.hits.value.length,0);
assert.ok(search.cacheSize()<=32);
console.log('PASS PDF search: 2400 hits across 120 pages, bounded text cache');
