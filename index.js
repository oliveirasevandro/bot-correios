/**
 * Created by eso on 18/04/17.
 */
'use strict'

const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const rastreio = require('rastreio').default;

console.log(typeof rastreio);

const app = express();

const token = process.env.PAGE_ACCESS_TOKEN;

app.set('port', (process.env.PORT || 5000));

app.use(bodyParser.urlencoded({extended: false}));

app.use(bodyParser.json());

app.get('/', function (req, res) {
    res.send('Hello, I am a chat bot');
});

app.get('/webhook', function (req, res) {

    if (req.query['hub.verify_token'] === 'my_voice_is_my_password_verify_me') {
        res.send(req.query['hub.challenge']);
    }

    res.send('Error, wrong token');

});

app.post('/webhook', function (req, res) {

    let data = req.body;

    // console.log(JSON.stringify(data, ' ', 4));

    if (data.object === 'page') {
        data.entry.forEach(entry => {
            let pageId = entry.id;
            let timeOfEvent = entry.time;

            entry.messaging.forEach(event => {
                if (event.message) {
                    receivedMessage(event);
                } else if (event.postback) {
                    receivedPostback(event);
                } else {
                    console.log('Webhook received unknown event: ', event);
                }
            });
        });

        res.sendStatus(200);
    }

});

app.listen(app.get('port'), function () {
    console.log('running on port ', app.get('port'));
});

function checkOrder(payload) {

    let payloadArray = payload.split(',');

    let opcoes = {
        resultado: payloadArray[0],
        formato: 'json'
    };

    return rastreio([payloadArray[1]], opcoes);
}


function receivedMessage(event) {

    let senderId = event.sender.id;
    let recipientId = event.recipient.id;
    let timeOfMessage = event.timestamp;
    let message = event.message;

    console.log('Received message for user %d and page %d at %d with message: ', senderId, recipientId, timeOfMessage);
    console.log(JSON.stringify(message));

    let messageId = message.mid;
    let messageText = message.text;
    let messageAttachments = message.attachments;

    if (messageText) {
        sendTemplateMessage(senderId, messageText);
    }

}

function sendTemplateMessage(senderId, messageText) {

    let templateMessage = {
        recipient: {
            id: senderId
        },
        message: {
            attachment: {
                type: "template",
                payload: {
                    template_type: "button",
                    text: "Quais atualizações gostaria de visualizar?",
                    buttons: [{
                        type: "postback",
                        title: "Todas",
                        payload: "T," + messageText
                    }, {
                        type: "postback",
                        title: "Última",
                        payload: "U," + messageText
                    }]
                }
            }
        }
    };

    callSendApi(templateMessage);
}


function receivedPostback(event) {

    let senderId = event.sender.id;
    let recipientId = event.recipient.id;
    let timeOfPostback = event.timestamp;

    let payload = event.postback.payload;

    console.log('Received postback for user %d and page %d with payload "%s" at %d', senderId, recipientId, payload, timeOfPostback);

    if (payload === 'starting') {
        sendTextMessage(senderId, 'Digite o número de rastreio da encomenda');
    } else {
        checkOrder(payload)
            .then(formatResult)
            .then(result => {
                sendTextMessage(senderId, result);
            });
    }


}

function sendTextMessage(recipientId, messageText) {

    let messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            text: messageText
        }
    };

    callSendApi(messageData);
}

function callSendApi(messageData) {
    request({
        uri: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {access_token: token},
        method: 'POST',
        json: messageData
    }, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            let recipientId = body.recipient_id;
            let messageId = body.message_id;

            console.log('Successfully sent generic message with id %s to recipient %s', messageId, recipientId);
        } else {
            console.error('Unable to send message.');
            console.error(response);
            console.error(error);
        }
    });
}

function formatResult(result) {

    console.log('Formating result: ', result);

    if (result.erro) {
        return 'Não foi possível localizar a encomenda';
    }

    return result;
}