const { args } = Deno;
import { parse } from "https://deno.land/std/flags/mod.ts";

// constants
const DEFAULT_WORKERS=1;
const DEFAULT_REPEAT=1;
const DEFAULT_TIMEOUT=5;
const REQUEST_TYPE_GET='GET';
const OUTPUT_FILE_PATH_PREFIX='/var/tmp/denoPerfResults/';
const OUTPUT_DESTINATION_CONSOLE='CONSOLE';
const DEFAULT_TEST_NAME='DEFAULT_TEST_NAME_01';
const MAX_TIMEOUT=120;
const MAX_WORKERS=500;
const MAX_REPEAT=1000000;
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
    if(options.o)
        return;
    const iter = workerProgress[Symbol.iterator]();
    let finishedRequests=0;
    for (let item of iter) {
        finishedRequests+=item[1];
    }
    const text=`\r${options.n} : Finished ${finishedRequests} out of ${totalRequests}`;
    Deno.stdout.write(encoder.encode(text));
    if(finishedRequests === totalRequests) {
        clearInterval(intervalHandle);
        Deno.stdout.write(encoder.encode('\n'));
    }
}

function calculateReqPerSec(timeMS:number, numResults:number) {
    const timeS=timeMS/1000;
    const rps=numResults/timeS;
    return parseInt(rps.toFixed(2));
}

async function calculateReadings(chartFileName:string="") {
    const ret:any={};
    Deno.truncateSync("/var/tmp/readings.log");
    const file = Deno.openSync("/var/tmp/readings.log", { write: true });
    const encoder=new TextEncoder();
    for(const val of workerResponse)
        Deno.writeSync(file.rid, encoder.encode(`${val}\n`));
    Deno.close(file.rid);
    const sutType=chartFileName?.split('/')?.pop()?.split('__')[0];
    const args=`/Users/mayankc/Work/source/deno-simpleHttpPerfTester/calculate.r ${chartFileName} ${sutType === 'deno' ? 'black': 'darkgreen'} ${sutType}`;
    logDebug(args);
    const p = Deno.run({
        cmd: ["Rscript", ...args.split(" ")],
        stdout: "piped",
        stderr: "piped",
    });
    await p.status();
    const out=await p.output();
    const decoder=new TextDecoder();
    const decodedOutput=decoder.decode(out).split('\n');
    for(let i=0; i<decodedOutput.length; i++) {
        let val=decodedOutput[i];
        if(val.startsWith('$')) {
            val=val.replace('$', '');
            val=val.replaceAll('`', '');
            ret[val]=parseFloat(parseFloat(decodedOutput[i+1].split(' ')[1]).toFixed(2));
            i++;
        }
    }
    return ret;
}

async function processWorkerResponses() {
    const stopTime=new Date(), stopTimeTs=Date.now(), stopTimeUtc=stopTime.toUTCString();
    await sleep(1200);
    logDebug(`Test completed at ${stopTimeUtc}`);
    const timeTaken=stopTimeTs-startTimeTs;
    logDebug(`Test took ${timeTaken} ms`);
    const testName=`${options.n}__${options.c}_${options.r}`;
    const result={  TestName: testName,
                    TimeTakenMS: timeTaken,
                    TotalRequests: workerResponse.length, 
                    ReqPerSec: calculateReqPerSec(timeTaken, workerResponse.length),
                };
    Object.assign(result, await calculateReadings(`${options.z}/${options.n}__${options.c}.png`));
    logTestResult(testName, result);
    Deno.exit();
}

function logTestResult(fileName: string, result: any) {
    if(options.o === OUTPUT_DESTINATION_CONSOLE) {
        console.table(result);
        return;
    }

    const fullFileName=`${OUTPUT_FILE_PATH_PREFIX}${fileName}`;
    Deno.writeTextFileSync(fullFileName, JSON.stringify(result));
    console.log(fullFileName);

    const readingsFileName=`${fullFileName.substring(0, fullFileName.lastIndexOf("_"))}.readings`;
    if(options.k)
        Deno.writeTextFileSync(readingsFileName, JSON.stringify(workerResponse));
}

function checkArgs(options: any) {
    options['c']=normalizeInt(options['c'], DEFAULT_WORKERS, MAX_WORKERS);
    options['r']=normalizeInt(options['r'], DEFAULT_REPEAT, MAX_REPEAT);
    if(!options['u']) {
        logError('URL must be specified through -u');
        return null;
    }
    options['m']=normalizeString(options['m'], REQUEST_TYPE_GET);
    options['o']=normalizeString(options['o'], OUTPUT_DESTINATION_CONSOLE);
    options['t']=normalizeInt(options['t'], DEFAULT_TIMEOUT, MAX_TIMEOUT);
    options['n']=normalizeString(options['n'], DEFAULT_TEST_NAME);
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

function preCheckJsonBody(data: string) {
    let ret=true;
    try {
        JSON.parse(data);
    } catch(err) {
        logError('Post body is not a valid JSON', data);
        ret=false;
    }

    return ret;
}

function preCheckFormBody(data: string) {
    const fields=data.split(";");
    for(const field of fields) {
        const tokens=field.split('=');
        if(tokens.length !== 2)
            return false;
    }
    return true;
}

function logError(...error: any) {
    console.log(error);
}

function logDebug(...args: any) {
    if(options.v)
        console.log(...args);
}

// Main code -------------------

const options=checkArgs(parse(args));
if(!options)
    Deno.exit();

if(options.d && !preCheckJsonBody(options.d))
    Deno.exit();

if(options.f && !preCheckFormBody(options.f))
    Deno.exit();

const   startTime=new Date(), 
        startTimeTs=Date.now(), 
        startTimeUtc=startTime.toUTCString(),
        totalRequests: number=options.c*options.r,
        encoder = new TextEncoder();

logDebug(`Starting test at ${startTimeUtc}`);
logDebug(`Parameters: Workers=${options.c}, repeat=${options.r}, url=${options.u}, method=${options.m}, timeout=${options.t}`);

for(let i=0; i<options.c; i++)
    workers.push(new Worker(new URL("./worker.ts", import.meta.url).href, { type: "module" }));

for(let i=0; i<options.c; i++) {
    const initMsg=Object.assign({}, options, {name: `worker-${i}`});
    workers[i].postMessage(initMsg);
}

printProgress();
const intervalHandle=setInterval(() => printProgress(), 1000);

for(let i=0; i<options.c; i++)
    workers[i].onmessage=handleMessageFromWorker;

