const { args } = Deno;
import { parse } from "https://deno.land/std/flags/mod.ts";

// constants
const DEFAULT_WORKERS=1;
const DEFAULT_REPEAT=1;
const DEFAULT_TIMEOUT=5;
const MAX_TIMEOUT=120;
const MAX_WORKERS=500;
const MAX_REPEAT=10000;
const REPORT_TYPE_PROGRESS='progress';
const REPORT_TYPE_RESULT='result';

//globals
let workers: any[]=[], workerResponse: number[]=[], workerProgress=new Map();
let finishedWorkers: number=0;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function handleMessageFromWorker(event: any) {
    //console.log('received data from worker ', event.data);
    switch(event.data.type) {
        case REPORT_TYPE_PROGRESS: {
            handleWorkerProgressEvent(event.data.name, event.data.value);
            break;
        }

        case REPORT_TYPE_RESULT: {
            handleWorkerResultEvent(event.data.value);
            break;
        }
    }
}

function handleWorkerProgressEvent(name: string, progress: number) {
    workerProgress.set(name, progress);
}

function handleWorkerResultEvent(result: number[]) {
    workerResponse.push(...result);
    finishedWorkers++;
    if(finishedWorkers === options.c)
        processWorkerResponses();
}

function printProgress() {
    const iter = workerProgress[Symbol.iterator]();
    let finishedRequests=0;
    for (let item of iter) {
        finishedRequests+=item[1];
    }
    const text=`\rFinished ${finishedRequests} out of ${totalRequests}`;
    Deno.stdout.write(encoder.encode(text));
    if(finishedRequests === totalRequests) {
        clearInterval(intervalHandle);
        Deno.stdout.write(encoder.encode('\n'));
    }
}

async function processWorkerResponses() {
    const stopTime=new Date(), stopTimeTs=Date.now(), stopTimeUtc=stopTime.toUTCString();
    await sleep(1200);
    logDebug(`Test completed at ${stopTimeUtc}`);
    const timeTaken=stopTimeTs-startTimeTs;
    logDebug(`Test took ${timeTaken} ms`);
    const result={  TimeTakenMS: timeTaken,
                    TotalRequests: workerResponse.length, 
                    Mean: mean(), 
                    Median: median(),
                    Min: Math.min(...workerResponse),
                    Max: Math.max(...workerResponse)
                };
    console.table(result);
    Deno.exit();
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

function preCheckPostBody(data: string) {
    let ret=true;
    try {
        JSON.parse(data);
    } catch(err) {
        logError('Post body is not a valid JSON');
        ret=false;
    }

    return ret;
}

function logError(error: any) {
    console.log(error);
}

function logDebug(...args: any) {
    if(options['v'])
        console.log(...args);
}

// Main code -------------------

const options=checkArgs(parse(args));
if(!options)
    Deno.exit();

if(options.d && !preCheckPostBody(options.d))
    Deno.exit();

const   startTime=new Date(), 
        startTimeTs=Date.now(), 
        startTimeUtc=startTime.toUTCString(),
        totalRequests: number=options.c*options.r,
        encoder = new TextEncoder();

logDebug(`Starting test at ${startTimeUtc}`);
logDebug(`Parameters: Workers=${options.c}, repeat=${options.r}, url=${options.u}, method=${options.m}, timeout=${options.t}`);

for(let i=0; i<options.c; i++)
    workers.push(new Worker("./worker.ts", { type: "module" }));

for(let i=0; i<options.c; i++) {
    const initMsg=Object.assign({}, options, {name: `worker-${i}`});
    workers[i].postMessage(initMsg);
}

printProgress();
const intervalHandle=setInterval(() => printProgress(), 1000);

for(let i=0; i<options.c; i++)
    workers[i].onmessage=handleMessageFromWorker;

