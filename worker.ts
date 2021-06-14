import { deferred } from "https://deno.land/std/async/deferred.ts";
let finished: number=0, workerName: string;

const REPORT_TYPE_PROGRESS='progress';
const REPORT_TYPE_RESULT='result';

const intervalHandle=setInterval(() => sendProgress(), 500);

self.onmessage = async (msg: any) => {
    const options=msg.data;
    workerName=options.name;
    const response=await runTest(options);
    sendProgress();
    clearInterval(intervalHandle);
    self.postMessage({type: REPORT_TYPE_RESULT, value: response});
    self.close();
};

function sendProgress() {
    self.postMessage({name: workerName, type: REPORT_TYPE_PROGRESS, value: finished});
}

async function runTest(options: any) {
    let response: number[]=[];
    let warmUp=options.w ? options.w: -1;
    for(let finished=0; finished<options.r+options.w; finished++) {
        let diffTS;
        if(options.u.startsWith('udp')) {
            diffTS=await runUDPTest(options);
        } else if(options.u.startsWith('ws')) {
            diffTS=await runWSTest(options);
        }
        else {
            diffTS=await runHTTPTest(options);
        }
        if((!warmUp || warmUp < 0) && diffTS !== -1)
            response.push(parseFloat(diffTS.toFixed(3)));
        if(warmUp >= 0)
            --warmUp;
    }
    return response;
}

async function runWSTest(options:any) {
    const tokens=options.u.split(":");
    const serverPort=parseInt(tokens[2]);
    const beforeTS=performance.now();
    const promise = deferred();
    const webSocket = new WebSocket(`ws://localhost:${serverPort}`);
    webSocket.onopen = () : void => webSocket.send(options.d);
    webSocket.onmessage = (): void => webSocket.close();
    webSocket.onclose = (): void => promise.resolve();
    await promise;
    const diffTS=performance.now()-beforeTS;
    return diffTS;
}

async function runUDPTest(options:any) {
    const tokens=options.u.split(":");
    const hostname='127.0.0.1';
    const transport='udp';
    const clientPort=parseInt(tokens[1])+parseInt(options.name.split("-")[1]), serverPort=parseInt(tokens[2]);
    const beforeTS=performance.now();
    const client=Deno.listenDatagram({ port: clientPort, transport });
    client.send(new TextEncoder().encode(options.d), {port: serverPort, transport, hostname});
    const [recvd, remote]=await client.receive();
    if(options.v)
        console.log(options, recvd);
    client.close();
    const diffTS=performance.now()-beforeTS;
    return diffTS;
}

async function runHTTPTest(options:any) {
    const fetchParams: RequestInit={
        method: options.m,
        redirect: 'follow'
    }
    if(options.d) {
        fetchParams.body=options.d;
        fetchParams.headers={};
        fetchParams.headers['Content-Type']='application/json';
        if(options.h) {
            const hdr=options.h.split("=");
            fetchParams.headers[hdr[0]]=hdr[1];
        }
    } else if(options.f) {
        const fields=options.f.split(";"),
                formData = new FormData();
        for(const field of fields) {
            const tokens=field.split('=');
            if(tokens.length == 2)
                formData.append(tokens[0], tokens[1]);
        }
        fetchParams.body=formData;
    }

    const beforeTS=performance.now();
    const responseData=await fetch(options.u, fetchParams);
    const diffTS=responseData.status === 404 ? -1 : performance.now()-beforeTS;
    let json;
    if(responseData.headers.get('content-type') === 'application/json')
        json=await responseData.json();
    else
        json=await responseData.text();
    if(options.v)
        console.log(options, json);
    return diffTS;
}
  
