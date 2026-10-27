import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),D=require('../games/crownfall-kart/engine/data.js'),E=require('../games/crownfall-kart/engine/environments.js');
test('every shipping course resolves to its own stable environment, without mutating track data',()=>{
 const before=JSON.stringify(D.TRACKS);const selected=D.TRACKS.map(t=>E.get(t));
 assert.equal(new Set(selected.map(p=>p.id)).size,D.TRACKS.length);
 assert.equal(new Set(selected.map(p=>p.architecture)).size,D.TRACKS.length);
 assert.equal(new Set(selected.map(p=>JSON.stringify(p.sky))).size,D.TRACKS.length);
 assert.equal(new Set(selected.map(p=>p.terrain)).size,D.TRACKS.length);
 assert.equal(JSON.stringify(D.TRACKS),before);assert.equal(E.get('Crown Skybridge'),E.get('shattered-crown'));assert.equal(E.get('missing'),E.get(0));
});
test('profiles contain bounded render parameters and frozen nested data',()=>{
 for(const p of E.profiles){assert.ok(Object.isFrozen(p)&&Object.isFrozen(p.atmosphere)&&Object.isFrozen(p.sky.sun));assert.ok(p.light.intensity>0&&p.light.exposure>0);assert.ok(p.surface.roughness>=0&&p.surface.roughness<=1);assert.ok(p.atmosphere.density>0&&p.atmosphere.density<.05);assert.ok(p.atmosphere.wet>=0&&p.atmosphere.wet<=1);assert.equal(p.sky.sun.length,3);assert.ok(p.sky.sun.every(Number.isFinite));assert.ok(p.weather.count>0&&p.weather.count<=1200);assert.ok(p.atmosphere.grade.every(n=>n>.5&&n<1.5));}
 assert.throws(()=>{E.profiles[0].sky.sun[0]=100;},TypeError);
});
test('weather and lighting identities include snow, rain, mist, embers and desert dust',()=>{
 const types=new Set(E.profiles.map(p=>p.weather.type));for(const type of ['snow','rain','mist','embers'])assert.ok(types.has(type));assert.ok(E.profiles.some(p=>p.weather.secondary==='dust'));assert.equal(E.get('stormspire').atmosphere.wet,1);assert.ok(E.get('ember-keep').atmosphere.rays>E.get('moonveil').atmosphere.rays);assert.ok(E.get('moonveil').atmosphere.density>E.get('ember-keep').atmosphere.density);
});
