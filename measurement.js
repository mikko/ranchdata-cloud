'use strict';

const AWS = require('aws-sdk');
const auth = require('./utils/auth');

const dynamoDb = new AWS.DynamoDB.DocumentClient();

const getSensorPrimaryKey = (user, sensorId) => {
    return `${user}#${sensorId}`
}

const primaryKeyToSensor = (key) => {
    const [user, serial] = key.split("#");
    return serial;
}

const primaryKeyToUser = (key) => {
    const [user, serial] = key.split("#");
    return user;
}


const getValueItem = (user, sensor, value, timestamp) => {
    const now = new Date().getTime()
    const expires_ms = now + 1000 * 60 * 60 * 24 * 7 * 4 // TODO: environment variable for TTL
    const expires_at = Math.round(expires_ms / 1000)
    timestamp = timestamp === undefined ? now : timestamp // Default to current timestamp

    const sensorId = getSensorPrimaryKey(user, sensor);

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

module.exports.create = async event => {
    const user = auth.getWriteAuthorizedUser(event)
    if (user === undefined || user === null) {
        console.log('Access denied');
        console.dir(event.headers);
        return; // Intentionally do not return anything and let 5xx fly
    }
    console.log("Access granted for user", user);
    const requestBody = JSON.parse(event.body);

    const value = requestBody.value;
    const timestamp = requestBody.timestamp;
    const sensor = event.pathParameters.sensor;

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
    } catch (err) {
        console.log("Something weird happened")
        console.log(err)
    }
};

const ddbToAPIMeasurement = (item) => {
    // { "sensorId": "23#second", "createdAt": 1623219371812, "value": 10, "expires_at": 1623305771812, "timestamp": 1623219370957 },
    // Obey the good old ranchdata API schema
    return {
        id: `${item.sensorId}_${item.timestamp}`,
        value: item.value,
        measurement_time: new Date(item.timestamp).toISOString(),
        serial: primaryKeyToSensor(item.sensorId),
        name: "", // TODO later when sensor API available
        unit: "", // TODO
        user_id: primaryKeyToUser(item.sensorId)
    }
}

module.exports.read = async event => {
    const user = auth.getReadAuthorizedUser(event)
    if (user === undefined || user === null) {
        console.log('Access denied');
        console.dir(event.headers);
        return; // Intentionally do not return anything and let 5xx fly
    }
    const sensor = event.pathParameters.sensor;

    const sensorId = getSensorPrimaryKey(user, sensor);
    const queryStart = parseInt(event.queryStringParameters.start);
    const queryEnd = parseInt(event.queryStringParameters.end);

    const queryObj = {
        TableName: process.env.MEASUREMENT_TABLE,
        KeyConditionExpression: "#sensor = :sensorId and #ts BETWEEN :start AND :end",
        ExpressionAttributeNames: {
            "#sensor": "sensorId",
            "#ts": "timestamp"
        },
        ExpressionAttributeValues: {
            ":sensorId": sensorId,
            ":start": queryStart,
            ":end": queryEnd,
        }
    };

    return new Promise((resolve, reject) => {
        dynamoDb.query(queryObj, function (err, data) {
            if (err) {
                console.error("Unable to query. Error:", JSON.stringify(err, null, 2));
                reject(error);
            } else {
                const apiMeasurements = data.Items.map(ddbToAPIMeasurement);
                resolve(apiMeasurements);
            }
        });
    })
        .then(data => {
            return {
                statusCode: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*', // Required for CORS support to work
                    'Access-Control-Allow-Credentials': true, // Required for cookies, authorization headers with HTTPS
                },
                body: JSON.stringify(data, null, 2)
            };
        })
        .catch(err => {
            console.log(err)
            return {
                statusCode: 500,
                body: "Unknown error"
            };
        });
}
