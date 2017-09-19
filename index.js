const sw = require('igenius-smith-waterman');
const _ = require('lodash');
const removePunctuation = require('remove-punctuation');
const fs = require('fs');

const gss = (k) => {
  return k;
};

const sim = (a, b) => {
  return a===b ? 100 : 0;
}

function words(text) {
  return text.split(/[ \t\r\n]/).filter(
  	(x) => x.length > 0
  );
}

function tokens(words) {
  return words.map(
  	(word) => {
  		return removePunctuation(word.toLowerCase());
  	}
  )
}

const TIMING = "AAATIMINGAAA";

var dict = {};
var nextChar = 97;
function mapWords(words, add) {
  return words.map(
  	(w) => {
  		if (dict[w]) {
  			return dict[w];
  		} else {
  			dict[w] = String.fromCharCode(nextChar++);
  			if (["\n", "\r", "-"].includes(dict[w])) {
  				dict[w] = String.fromCharCode(nextChar++);
  			}
  			return dict[w];
  		}
  	}
  )
}

const exampleCaption = "00:00:04 --> 00:00:11";
const timings = [];
function uncaption(text) {
  return text.split("\n").map(
  	(line) => {
  		timings.push(line.substring(0, exampleCaption.length));
  		return TIMING + "-" + (timings.length - 1) + " " + line.substring(exampleCaption.length + 1);
  	}
  ).join(" ");
}

/*const text1 = `00:00:00 --> 00:10:15 This's is an example
00:10:15 --> 01:15:23 hi gary
01:15:23 --> 02:02:02 the example aaa`;

const text2 = `Thiss is not a Example. Hi Gary. The Best Example.`;
console.log('loading 1');*/

const text1 = require('./116841.json').captions.join("\n");

console.log('loading 2');
const text2 = fs.readFileSync('./speech.txt', 'utf8');
console.log('uncaptioning');
const words1 = words(uncaption(text1));

const words2 = words(text2);
console.log('wording');

// If you want to see this for the whole speech, remove these or set to 6,000
const tokens1 = 
  _.take(tokens(words1), 200)
const tokens2 = _.take(words2, 200);

let res = doAlignment(tokens1, tokens2).split("\n");
let text = _.take(res, res.length - 1).join("\n");

console.log(text);
fs.writeFileSync("./captions.json", JSON.stringify({captions: text.split("\n")}, null, ' '));
 
function doAlignment(tokens1, tokens2) {
  _.intersection(
    _.uniq(tokens1),
    _.uniq(tokens2)
  ).map(
    (w) => mapWords([w], true)
  );

  console.log('mapping/tokenizing 2');
  const seq2 = mapWords(tokens2, false).join('');

  console.log('mapping/tokenizing 1');
  const seq1 = mapWords(tokens1, false).join('');

  const lrwords = [words1, words2];

  console.log('aligning ' + seq1.length + ', ' + seq2.length);
  console.log(new Date());
  fs.writeFileSync('seq1.json', JSON.stringify(seq1));
  fs.writeFileSync('seq2.json', JSON.stringify(seq2));
  fs.writeFileSync('dict.json', JSON.stringify(dict));
  fs.writeFileSync('lrwords.json', JSON.stringify(lrwords));

  const result = sw.align(seq1, seq2, gss, sim);

  console.log(new Date());

  console.log('inverting');
  const rev = _.invert(dict);

  console.log('converting');
  const kw = result.message.split('\n')
    .map(
      (string, strIdx) => {
    	  var pos = 0;
        return string.split('').map(
  	    	(char) => {
     			if (char === '-') {
    				return char;
    			} else {
    				return lrwords[strIdx][pos++];
    			}
    		}
    	)
    }
  )

  console.log('reconstructing');
  let peekwords = 5;

  const finalScript = _.zip(
    kw[0],
    kw[1]
  ).map(
    ([a, b], idx) => {
    	if (a.indexOf(TIMING) === 0) {
  		  let timingcount = parseInt(a.substring(TIMING.length + 1));
    		let result = null;
    		if (timingcount === 0) {
    			result = [timings[timingcount], ' '];
    			if (b !== '-') {
    				result.push(b);
    				result.push(' ');
    			}
    		} else {
    			result = [];
    			if (b !== '-') {
    				result.push(b);
    				result.push(' ');
    			}
    			let added = 0;
    			for (let i = idx + 1; added < peekwords - 1 && i < kw[1].length; i++) {
    				const peek = kw[1][i];
    				if (peek.indexOf(TIMING) === 0 && peek !== '-') {
    					result.push(peek);
    					result.push(' ');
    					added++;	
    				}
    			}
    			result.push("\n");
    			result.push(timings[timingcount]);
    			result.push(" ");
    			if (b !== '-') {
    				result.push(b);
    				result.push(' ');
    			}
    		}

    		return result;
    	} else {
    		if (b === '-') {
    			// noop - this just something that's not on the caption side
    			return [];
    		} else {
    			return [b, ' ']; // matched word from the transcript
    		}
    	}
    }
  );

  const alltokens = _.flatten(finalScript);

  const toString = alltokens.filter(
    	(w, i) => {
    		if (w === "\n") {
    			if (i > 1) {
    				if (alltokens[i - 2].indexOf(" --> ") > 0) {
    					return false;
    				}
    			}
    		}
    		if (w === " ") {
    			if (i > 0) {
    				if (alltokens[i - 1].indexOf(" --> ") > 0 &&
    				    alltokens[i + 1] === "\n") {
    					return false;
    				} else {
    					return true;
    				}
    			}
    		}


    		if (w.indexOf(' --> ') < 0) {
    			return true;
    		}

    		if (i < alltokens.length + 2) {
    			if (alltokens[i + 2] === "\n") {
    				return false;
    			}
    		}

    		return true;
    	}
    ).join('');

  return toString;
}
