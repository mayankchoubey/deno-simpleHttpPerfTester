const { args } = Deno;
import { parse } from "https://deno.land/std/flags/mod.ts";

// constants
const DEFAULT_WORKERS=1;
const DEFAULT_REPEAT=1;
const DEFAULT_TIMEOUT=5;
const MAX_TIMEOUT=120;
const MAX_WORKERS=50;
const MAX_REPEAT=1000;

//globals
let workers: any[]=[], workerResponse: number[]=[];
let finishedWorkers: number=0;

const options=checkArgs(parse(args));
if(!options) {
    Deno.exit();
}
const startTime=new Date(), startTimeTs=Date.now(), startTimeUtc=startTime.toUTCString();
logDebug(`Starting test at ${startTimeUtc}`);
logDebug(`Parameters: Workers=${options.c}, repeat=${options.r}, url=${options.u}, method=${options.m}, timeout=${options.t}`);

for(let i=0; i<options.c; i++)
    workers.push(new Worker("./worker.ts", { type: "module" }));

for(let i=0; i<options.c; i++)
    workers[i].postMessage(options);

for(let i=0; i<options.c; i++)
    workers[i].onmessage=handleMessageFromWorker;

function handleMessageFromWorker(event: any) {
    //console.log('received data from worker ', event.data);
    workerResponse.push(...event.data);
    finishedWorkers++;
    if(finishedWorkers === options.c)
        processWorkerResponses();
}

function processWorkerResponses() {
    const stopTime=new Date(), stopTimeTs=Date.now(), stopTimeUtc=stopTime.toUTCString();
    logDebug(`Test completed at ${stopTimeUtc}`);
    const timeTaken=stopTimeTs-startTimeTs;
    logDebug(`Test took at ${timeTaken}ms`);
    const result={  totalRequests: workerResponse.length, 
                    mean: mean(), 
                    median: median(),
                    min: Math.min(...workerResponse),
                    max: Math.max(...workerResponse)
                };
    console.table(result);
}

function mean() {
    let total=0;
    for(let i=0; i<workerResponse.length; i++) {
        total += workerResponse[i];
    }
    return total / workerResponse.length;
}

const median = () => {
    const   mid = Math.floor(workerResponse.length / 2),
            nums = [...workerResponse].sort((a, b) => a - b);
    return workerResponse.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
};

function checkArgs(options: any) {
    options['c']=normalizeInt(options['c'], DEFAULT_WORKERS, MAX_WORKERS);
    options['r']=normalizeInt(options['r'], DEFAULT_REPEAT, MAX_REPEAT);
    if(!options['u']) {
        logError('URL must be specified through -u');
        return null;
    }
    options['m']=normalizeString(options['m'], 'GET');
    options['t']=normalizeInt(options['t'], DEFAULT_TIMEOUT, MAX_TIMEOUT);
    return options;
}

function normalizeInt(val: number, defaultVal: number, maxVal: number) {
    if(!val)
        return defaultVal;
    if(val > maxVal)
        return maxVal;
    return val;
}

function normalizeString(val: string, defaultVal: string) {
    if(!val)
        return defaultVal;
    return val;
}

function logError(error: any) {
    console.log(error);
}

function logDebug(...args: any) {
    if(options['v'])
        console.log(...args);
}