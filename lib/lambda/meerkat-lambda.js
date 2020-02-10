const AWS = require('aws-sdk');

exports.handler = async function(event) {
  console.log("request:", JSON.stringify(event, undefined, 2));
  const dynamo = new AWS.DynamoDB();
  var item = await dynamo.getItem({
    TableName: process.env.TABLE_NAME,
    Key:{
      name: {
        S: 'preety-meerkat'
      }
    }
  }).promise();
  return {
    statusCode: 200,
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify(item),
  };
}