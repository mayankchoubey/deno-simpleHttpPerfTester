let response: number[]=[];

self.onmessage = async (msg: any) => {
    const options=msg.data;
    await runTest(options);
    self.postMessage(response);
    self.close();
};

async function runTest(options: any) {
    for(let i=0; i<options.r; i++) {
        const beforeTS=Date.now();
        await fetch(options.u, {
            method: options.m,
            redirect: 'follow',
        });
        const afterTS=Date.now();
        response.push(afterTS-beforeTS);
    }
}
  
