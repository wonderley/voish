#! /usr/bin/env node

'use strict';

const execSync = require('child_process').execSync;
const aCommandsAndPhrases = [
  [executeCommand.bind(this, 'ls'), ['show files', 'show all files', 'list', 'list files']],
  [executeCommand.bind(this, 'pwd'), ['current directory', 'path', 'show path', 'show current directory']],
  [stop, ['stop', 'quit', 'exit']],
  [copy, ['copy']],
]

function streamingMicRecognize(encoding, sampleRateHertz, languageCode) {
  const aPhrases = aCommandsAndPhrases.map(aCommandAndPhrase => aCommandAndPhrase[1]).reduce(
    // flatten
    function(a, b) {
      return a.concat(b);
    },
    []
  );
  console.log(`phrases: ${aPhrases}`);
  // [START speech_streaming_mic_recognize]
  const record = require('node-record-lpcm16');

  // Imports the Google Cloud client library
  const speech = require('@google-cloud/speech');

  // Creates a client
  const client = new speech.SpeechClient();

  // all options are found here:
  // node_modules/@google-cloud/speech/src/v1/doc/google/cloud/speech/v1/doc_cloud_speech.js
  const request = {
    config: {
      encoding: encoding,
      sampleRateHertz: sampleRateHertz,
      languageCode: languageCode,
      speechContexts: [{ phrases: aPhrases }],
    },
    interimResults: false, // If you want interim results, set this to true
    // The following could improve performance but forces recognition to be repeatedly restarted.
    // Noted in https://cloud.google.com/speech/docs/best-practices
    // singleUtterance: true,
  };

  // Create a recognize stream
  const recognizeStream = client
    .streamingRecognize(request)
    .on('error', console.error)
    .on('data', data => {
      if (!data.results[0] || !data.results[0].alternatives[0]) {
        console.log('Reached transcription time limit, press Ctrl+C');
        return;
      }
      if (data.results.length > 1) {
        console.log('multiple data responses received! Using the first.');
      }
      // Use the first alternative. TODO - check multiple alternatives
      const sTranscript = data.results[0].alternatives[0].transcript.trim().toLowerCase();
      console.log(`Transcript: ${sTranscript}`);
      const fIntent = transcriptToIntent(sTranscript);
      fIntent && fIntent(sTranscript);
    });

  // Start recording and send the microphone input to the Speech API
  record
    .start({
      sampleRateHertz: sampleRateHertz,
      threshold: 0,
      // Other options, see https://www.npmjs.com/package/node-record-lpcm16#options
      verbose: false,
      recordProgram: 'rec', // Try also "arecord" or "sox"
      silence: '10.0',
    })
    .on('error', console.error)
    .pipe(recognizeStream);

  console.log('Listening, press Ctrl+C or say "stop" to stop.');
}

function transcriptToIntent(sTranscript) {
  const aFoundCommand = aCommandsAndPhrases.find(aCommandTemplate => {
    return aCommandTemplate[1].includes(sTranscript);
  });
  if (aFoundCommand) return aFoundCommand[0];
  // More loose search
  const aFoundCommand2 = aCommandsAndPhrases.find(aCommandTemplate => {
    return sTranscript.includes(aCommandTemplate[1]);
  });
  return aFoundCommand2[0];
}

function copy(sTranscript) {
  console.log(`copy command with transcript ${sTranscript}`);
}

function stop() {
  process.exit(0);
}

function executeCommand(sCommand) {
  const sResult = execSync(sCommand).toString();
  sResult && console.log(sResult);
}

const argv = require(`yargs`)
  .options({
    encoding: {
      alias: 'e',
      default: 'LINEAR16',
      global: true,
      requiresArg: true,
      type: 'string',
    },
    sampleRateHertz: {
      alias: 'r',
      default: 16000,
      global: true,
      requiresArg: true,
      type: 'number',
    },
    languageCode: {
      alias: 'l',
      default: 'en-US',
      global: true,
      requiresArg: true,
      type: 'string',
    },
  }).argv;

streamingMicRecognize(
  argv.encoding,
  argv.sampleRateHertz,
  argv.languageCode
);
