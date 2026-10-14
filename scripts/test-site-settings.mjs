import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'bqm-settings-'));
const helper=new URL('./build-env.mjs',import.meta.url).href;
const settings={network:'botMainnet',mainnetContractAddress:'',testnetContractAddress:'',walletConnectProjectId:'',publicAppUrl:''};
const run = () => {
 const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.startsWith('VITE_')));
 env.GITHUB_REPOSITORY='jefmark/base-quest-milestones-bot-mainnet';
 fs.writeFileSync(path.join(root,'site-settings.json'),JSON.stringify(settings));
 return spawnSync(process.execPath,['--input-type=module','-e',`import {loadPublicBuildEnv} from ${JSON.stringify(helper)};loadPublicBuildEnv(${JSON.stringify(root)});console.log(JSON.stringify(Object.fromEntries(Object.entries(process.env).filter(([k])=>k.startsWith('VITE_')))))`],{env,encoding:'utf8'});
};
try {
 let r=run();assert.equal(r.status,0,r.stderr);let env=JSON.parse(r.stdout);
 assert.equal(env.VITE_SETUP_ONLY,'true');assert.equal(env.VITE_PUBLIC_APP_URL,'https://jefmark.github.io/base-quest-milestones-bot-mainnet/');
 settings.mainnetContractAddress='0x1111111111111111111111111111111111111111';r=run();assert.equal(r.status,0,r.stderr);env=JSON.parse(r.stdout);assert.equal(env.VITE_SETUP_ONLY,'false');
 settings.mainnetContractAddress='bad address';assert.notEqual(run().status,0);
 console.log('Public JSON settings: setup mode, automatic Pages URL, configured mint mode and invalid address rejection passed.');
} finally {fs.rmSync(root,{recursive:true,force:true});}
