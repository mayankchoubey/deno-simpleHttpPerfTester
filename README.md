# deno-simpleHttpPerfTester
A simple HTTP performance tester that runs in deno.

Based on the required concurrency, this tester spawns workers which continuously sends HTTP requests to the URL. 

Inputs:<br/>
  -c concurrent requests<br/>
  -r times to repeat<br/>
  -t timeout<br/>
  -v verbose<br/>
  -m method<br/>
  -u url<br/>

No extra installation required. Simply run using following command:

```
deno run --allow-read --allow-net https://raw.githubusercontent.com/mayankchoubey/deno-simpleHttpPerfTester/master/tester.ts -u http://localhost:8000 -c 1 -r 100 -t 5 -v -m GET
```

Future work:<br/>
  -Add support for POST body<br/>
  -Output in JSON format<br/>
  -Check response fields<br/>
