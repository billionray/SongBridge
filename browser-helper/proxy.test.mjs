import test from 'node:test';
import assert from 'node:assert/strict';
import {selectProxy,browserProxy,proxyURL} from './proxy.mjs';
test('环境变量优先，端口不固定',()=>{assert.equal(selectProxy({HTTPS_PROXY:'http://127.0.0.1:9876'},{ProxyEnable:1,ProxyServer:'127.0.0.1:1234'}).url,'http://127.0.0.1:9876')});
test('读取系统统一代理及按协议设置',()=>{assert.equal(selectProxy({},{ProxyEnable:1,ProxyServer:'127.0.0.1:2345'}).url,'http://127.0.0.1:2345');assert.equal(selectProxy({},{ProxyEnable:1,ProxyServer:'http=localhost:3456;https=localhost:4567'}).url,'http://localhost:4567')});
test('关闭代理及仅有 PAC 时不猜端口',()=>{assert.equal(selectProxy({},{ProxyEnable:0,ProxyServer:'localhost:1'}).url,'');assert.equal(selectProxy({},{AutoConfigURL:'http://localhost/proxy.pac'}).url,'');assert.equal(proxyURL('not a proxy'),'')});
test('浏览器代理排除回环地址，并分离认证',()=>{const p=browserProxy('http://user:pass@localhost:5678');assert.equal(p.server,'http://localhost:5678');assert.equal(p.username,'user');assert.match(p.bypass,/127\.0\.0\.1/)});
