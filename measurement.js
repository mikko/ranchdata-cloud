'use strict';

const AWS = require('aws-sdk');

const dynamoDb = new AWS.DynamoDB.DocumentClient();

const getValueItem = (user, sensor, value, timestamp) => {
    const now = new Date().getTime()
    const expires_at = now + 1000 * 60 * 60 * 24 // * 7 * 4 should be later four weeks
    timestamp = timestamp === undefined ? now : timestamp // Default to current timestamp

    const sensorId = `${user}#${sensor}`;

    return {
        createdAt: now,
        timestamp: timestamp,
        sensorId,
        value,
        expires_at
    }
}

const saveValue = valueItem => {
    const record = {
        TableName: process.env.MEASUREMENT_TABLE,
        Item: valueItem
    }
    return new Promise((resolve, reject) => {
        try {
            console.dir(record);
            dynamoDb.put(record, (err, data) => {
                if (err) {
                    console.log("Something went wrong saving measurement value")
                    return reject(err)
                }
                resolve();
            })
        } catch (err) {
            console.log(err)
        }
    });
}

const getUser = token => {
    console.log("HÄLÄRM missing user token handling")
    return -1;
}

module.exports.create = async event => {
    const requestBody = JSON.parse(event.body);

    const value = requestBody.value;
    const timestamp = requestBody.timestamp;
    const sensor = event.pathParameters.sensor;
    const user = getUser();
    try {
    return await saveValue(getValueItem(user, sensor, value, timestamp))
        .then(() => {
            console.log("Succesfully saved measurement");
            return {
                statusCode: 200,
                body: JSON.stringify(
                    {
                        message: "Successfully saved new measurement",
                        sensor,
                        value,
                        timestamp,
                    },
                    null,
                    2
                )
            };
        })
        .catch(err => {
            console.log(err)
            return {
                statusCode: 500,
                body: JSON.stringify(err, null, 2)
            }
        })
    }
    catch (err) {
        console.log("Something weird happened")
        console.log(err)
    }
};
//
// saveValue(getValueItem("0", "asd", 13, new Date().getTime()))
//     .then(data => console.dir(data))
//     .catch(err => console.dir(err));
