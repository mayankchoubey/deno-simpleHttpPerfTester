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
    for(finished=0; finished<options.r; finished++) {
        const beforeTS=Date.now();
        const fetchParams: RequestInit={
            method: options.m,
            redirect: 'follow'
        }
        if(options.d) {
            fetchParams.body=options.d;
            fetchParams.headers={};
            fetchParams.headers['Content-Type']='application/json';
        } else if(options.f) {
            const tokens=options.f.split('=');
            if(tokens.length == 2) {
                const formData = new FormData();
                formData.append(tokens[0], tokens[1]);
                fetchParams.body=formData;
            }
        }

        const responseData=await fetch(options.u, fetchParams);
        const afterTS=Date.now();
        const json=await responseData.json();
        response.push(afterTS-beforeTS);
    }
    return response;
}
  
