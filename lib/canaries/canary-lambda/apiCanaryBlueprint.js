const https = require('https');
const http = require('http');

// This is the exact Lambda code as created by the amazing CloudWatch Synthetics, which is not yet available via CFN

const apiCanaryBlueprint = async function (event) {
    const postData = "";  
    const verifyRequest = async function (requestOption) {
      return new Promise((resolve, reject) => {
        console.log("Making request with options: " + JSON.stringify(requestOption));
        let req
        if (requestOption.port === 443) {
          req = https.request(requestOption);
        } else {
          req = http.request(requestOption);
        }
        req.on('response', (res) => {
          console.log(`Status Code: ${res.statusCode}`)
          console.log(`Response Headers: ${JSON.stringify(res.headers)}`)
          if (res.statusCode !== 200) {
             reject("Failed: " + requestOption.path);
          }
          res.on('data', (d) => {
            console.log("Response: " + d);
          });
          res.on('end', () => {
            resolve();
          })
        });

        req.on('error', (error) => {
          reject(error);
        });

        if (postData) {
          req.write(postData);
        }
        req.end();
      });
    }

    const headers = {}
    const requestOptions = {"hostname":event.API_URL,"method":"GET","path":"","port":80}
    requestOptions['headers'] = headers;
    await verifyRequest(requestOptions);
};

exports.handler = async (event) => {
    return await apiCanaryBlueprint(event);
};