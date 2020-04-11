import React from 'react';
import "./qrcode.css";

const messageString = "HELLO WORLD".toUpperCase();
var encodedMessageString = "";
const error_correction_level = "Q";
const mode = "alphanumeric";
const mode_indicator = "0010";
//CHARACTER CAPACITY LIST FOR ALPHANUMERIC MODE AND Q LEVEL ERROR CORRECTION
const character_capacities = [16, 29, 47, 67, 87, 108, 125, 157, 189, 221, 259, 296, 352, 376, 426, 470, 531, 574, 644, 702, 742, 823, 890, 963, 1041, 1094, 1172, 1263, 1322, 1429, 1499, 1618, 1700, 1787, 1867, 1966, 2071, 2181, 2298, 2420]
var qrVersion = 0;
const character_count_table = [[1, 9, 9], [10, 26, 11], [27, 40, 13]]
var character_count_indicator = "";
var character_count_indicator_length = 0;
const data_codeword_array=[13, 22, 34, 48, 62, 76, 88, 110, 132, 154, 180, 206, 244, 261, 295, 325, 367, 397, 445, 485, 512, 568, 614, 664, 718, 754, 808, 871, 911, 985, 1033, 1155, 1171, 1231, 1286, 1354, 1426, 1502, 1582, 1666];
const error_correction_array = [13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30];
var qrBitmap;

//GALOIS FIELD LOG-ANTILOG TABLES
var antilog_table = [], log_table = [];
//POLYNOMIALS
var messagePolynomial = [], generatorPolynomial = [];
//CODEWORDS
var data_codeword, error_correction_codeword, final_codeword, final_codeword_byte = "";


export default class Qrcode extends React.Component{
    //DECIDE THE QR CODE VERSION
    decideVersion(){
        var length = messageString.length;
        for(var i = 0; i < 40; i++){
            if(character_capacities[i] >= length){
                qrVersion = i + 1;
                break;
            }
        }
    }
    /*decideModeIndicator(){
        if(mode === "numeric") mode_indicator = "0001";
        else if(mode === "alphanumeric") mode_indicator = "0010";
        else if(mode === "byte") mode_indicator = "0100";
        else if(mode === "kanji") mode_indicator = "1000";
        else if(mode === "eci") mode_indicator = "0111";
        console.log(mode_indicator);
    }*/
    decideCharCountIndicatorLength(){
        if(qrVersion >= 1 && qrVersion <= 9) character_count_indicator_length = 9;
        else if(qrVersion >= 10 && qrVersion <= 26) character_count_indicator_length = 11;
        else if(qrVersion >= 27 && qrVersion <= 40) character_count_indicator_length = 13;
    }
    decideCharCountIndicator(){
        var messageLength = messageString.length;
        var paddingString="";
        var messageLengthBinary = messageLength.toString(2);
        for(var i = 0; i < (character_count_indicator_length - messageLengthBinary.length); i++){
            paddingString += "0";
        }
        character_count_indicator = paddingString.concat(messageLengthBinary);
    }
    encodeDuplet(string){
        var A, B, dupletString, paddingString = "", i;
        if(string.length === 2){
            A = string.charCodeAt(0) - 55;
            B = string.charCodeAt(1) - 55;
            if(A === -23) A = 36;
            if(B === -23) B = 36;
            dupletString = (45 * A + B).toString(2);
            for( i = 0; i < (11- dupletString.length); i++){
                paddingString += "0";
            }
            dupletString  = paddingString.concat(dupletString);
        }
        else if(string.length === 1){
            A = string.charCodeAt(0) - 55;
            if(A === -23) A = 36;
            dupletString = A.toString(2);
            for(i = 0; i < (6- dupletString.length); i++){
                paddingString += "0";
            }
            dupletString  = paddingString.concat(dupletString);
        }
        encodedMessageString=encodedMessageString.concat(dupletString);
    }
    encodeMessage(){
        var duplet;
        var length = messageString.length;
        for(var i = 0; i< length; i += 2){
            if((i + 1) < length){
                duplet = messageString[i].concat(messageString[i+1]);
            }
            else duplet = messageString[i];
            this.encodeDuplet(duplet);
        }
    }
    padMessage(){
        var totalSize = data_codeword_array[qrVersion - 1] * 8;
        var terminatorSize, length = encodedMessageString.length;
        terminatorSize = totalSize - length;
        if(terminatorSize > 4){
            terminatorSize = 4;
        }
        //add terminator
        for(var i = 0; i < terminatorSize; i++){
            encodedMessageString += "0";
        }
        //make length a multiple of 8
        length = encodedMessageString.length;
        if(length < totalSize){
            let padCount = 8 - (length % 8);
            for(i = 0; i < padCount; i++){
                encodedMessageString += "0";
            }
        }
        //add the 236-17 padding
        length = encodedMessageString.length;
        if(length < totalSize){
            let padCount = (totalSize - length) / 8;
            for(i = 1; i < (padCount / 2); i++){
                encodedMessageString += "1110110000010001"
            }
            if(padCount % 2 === 1) encodedMessageString += "11101100"
        }
    }

    //GENERATE THE GALOIS FIELD LOG AND ANTILOG TABLES
    generateLogAntilogTable(){
        antilog_table.push(1);
        var val = 1;
        for(var i = 1; i < 256; i++){
            val = antilog_table[i-1];
            val *= 2;
            if(val > 255) val = val ^ 285;
            antilog_table.push(val);
            log_table[val] = i;
        }
        log_table[1] = 0;
    }
    generateMessagePolynomial(){
        var length = encodedMessageString.length;
        for (var i = 0; i < length /8; i++){
            messagePolynomial.push(parseInt(encodedMessageString.slice(8*i, 8*i + 8), 2))
        }
        console.log()
        return messagePolynomial;
    }

    multiplyPolynomial(a, b){
        var order = a.length + b.length - 2;
        var f = [];
        for(var i= 0; i <= order; i++){
            f.push(0);
        }
        for(i = 0; i < a.length; i++){
            for(var j = 0; j < b.length; j++){
                var sum = (a[i] + b[j]) % 255;
                var num = antilog_table[sum];
                if(f[i + j] !== 0){
                    num = num ^ f[i+j];
                }
                f[i+j] = num;
            }
        }
        for(i= 0; i <= order; i++){
            f[i] = log_table[f[i]];
        }
        return f;
    }

    generateGeneratorPolynomial(){
        var polynomial_size = error_correction_array[qrVersion - 1];
        var f = [0, 0];
        var m = [0, 1];
        for(var i = 0; i<polynomial_size - 1; i++){
            m[1] = i + 1;
            f = this.multiplyPolynomial(f, m);
        }
        generatorPolynomial = f;
    }

    dividePolynomial(dividend, divisor){
        var rem = [];
        var startIndex = -1;
        var quotient;
        var flag = false;
      
        for(var i = 0; i <= (dividend.length - divisor.length); i++){
            //check if quotient is non-zero , if found break;
            quotient = parseInt((dividend[i] / divisor[0]));
            if(quotient !== 0){
                startIndex = i;
                flag = true;
                break;
            }
            else{
                rem.push(dividend[i])
            }
        }

        //if flag is false then all the quotients are zero
        //hence division is not possible

        if(flag){
            for(i = startIndex; i < dividend.length; i++){
                if(i >= startIndex + divisor.length) rem.push(dividend[i]);
                else rem.push(dividend[i] - quotient * divisor[i - startIndex]);
            }
            for(i = 0; i < rem.length; i++){
                if(rem[i] === 0) rem.shift();
                else break;
            }
        }

        return rem;
        if(!flag) return dividend;
        else return this.dividePolynomial(rem , divisor);
    }

    divideGalois(dividend, divisor){
        var quotient = log_table[dividend[0]];
        var a = dividend.slice();
        var b = divisor.slice();
        var rem = [];

        for(var i = 0; i < b.length; i++){
            //add quotient to all the exponents if it is not -1
            if(b[i] >= 0) b[i] = antilog_table[(quotient + b[i]) % 255];
            else b[i] = 0;
        }
        
        //xor the result with message polynomial
        for(i = 0; i < b.length; i++){
            rem[i] = a[i] ^ b[i];
        }
        return rem;
    }

    generateErrorCorrectionCodewords(){
        //REED-SOLOMON ERROR CORRECTION CODEWORDS
        var dividend = messagePolynomial.slice();
        var divisor = generatorPolynomial.slice();

        //make the arrays to same size
        for(var i = 0; i < error_correction_array[qrVersion - 1]; i++){
            dividend.push(0);
        }
        for(i = 0; i < (dividend.length - generatorPolynomial.length); i++){
            divisor.push(-1);
        }

        var rem = dividend.slice();
        
        for(i = 0; i < messagePolynomial.length; i++){
            rem = this.divideGalois(rem, divisor);
            for(var j = 0; j < rem.length; j++){
                if(rem[j] === 0){
                    rem.shift();
                    divisor.pop();
                }
                else break;
            }
        }
        return rem;
    }

    structureFinalMessage(){
        final_codeword = data_codeword.concat(error_correction_codeword);
        console.log("final codeword: " + final_codeword);
        var bitString;
        
        var i, j;
        for( i = 0; i < final_codeword.length; i++){
            var paddingString = "";
            bitString = final_codeword[i].toString(2);
            for( j = 0; j < (8 - bitString.length); j++){
                paddingString += "0";
            }
            bitString = paddingString + bitString;
            final_codeword_byte += bitString
        }
        console.log("final codeword bit string: " + final_codeword_byte);
        console.log("final codeword length: " + final_codeword_byte.length)
    }

    drawQR(){
        var sizeModules = 17 + 4 * qrVersion;
        var scale = 10;
        var sizePixels = sizeModules * scale;
        qrBitmap = new Array(sizeModules);

        var canvas = document.getElementById("qrCanvas");
        var context = canvas.getContext("2d");
        
        canvas.width = sizePixels;
        canvas.height = sizePixels;

        var i, j;
        for(i = 0; i < sizeModules ; i++){
            qrBitmap[i] = new Array(sizeModules);
            for(j = 0; j < sizeModules ; j++){
                qrBitmap[i][j] = 1;
            }
        }

        
        //DRAW FINDER PATTERNS OR CONTROL POINTS
        for(i = 0; i < 7; i++){
            qrBitmap[i][0] = 2;
            qrBitmap[6][i] = 2;
            qrBitmap[i][6] = 2;
            qrBitmap[0][i] = 2;
            qrBitmap[i + sizeModules - 7][0] = 2;
            qrBitmap[sizeModules - 1][i] = 2;
            qrBitmap[i + sizeModules - 7][6] = 2;
            qrBitmap[ + sizeModules - 7][i] = 2;
            qrBitmap[i][sizeModules - 7] = 2;
            qrBitmap[6][i + sizeModules - 7] = 2;
            qrBitmap[i][sizeModules - 1] = 2;
            qrBitmap[0][i + sizeModules - 7] = 2;
        }
        for(i = 1; i < 6; i++){
            qrBitmap[i][1] = 3;
            qrBitmap[5][i] = 3;
            qrBitmap[i][5] = 3;
            qrBitmap[1][i] = 3;
            qrBitmap[i + sizeModules - 7][1] = 3;
            qrBitmap[sizeModules - 2][i] = 3;
            qrBitmap[i + sizeModules - 7][5] = 3;
            qrBitmap[sizeModules - 6][i] = 3;
            qrBitmap[i][sizeModules - 6] = 3;
            qrBitmap[5][i + sizeModules - 7] = 3;
            qrBitmap[i][sizeModules - 2] = 3;
            qrBitmap[1][i + sizeModules - 7] = 3;
        }
        for(i = 2; i < 5; i++){
            for(j = 2; j < 5; j++){
                qrBitmap[i][j] = 2;
                qrBitmap[i + sizeModules - 7][j] = 2;
                qrBitmap[i][j + sizeModules - 7] = 2;
            }
        }


        //ADD SEPARATORS 
        for(i = 0; i < 8; i++){
            qrBitmap[7][i] = 3;
            qrBitmap[i][7] = 3;
            qrBitmap[i][sizeModules - 8] = 3;
            qrBitmap[sizeModules - 8][i] = 3;
            qrBitmap[7][i + sizeModules - 8] = 3;
            qrBitmap[i + sizeModules - 8][7] = 3;
        }

        //ADD ALIGNMENT PATTERNS FOR VERSION GREATER THAN 2
        //CURRENTLY WORKING FOR VERSION 1
        //SO NO ALIGNMENT PATTERN


        //ADD TIMING PATTERNS
        for(i = 8; i < sizeModules - 8; i++){
            qrBitmap[6][i] = i % 2;;
            qrBitmap[i][6] = i % 2;;
        }

        //FORMAT INFORMATION AREA
        for(i = 0; i < 8; i++){
            qrBitmap[8][i] = 4;
            qrBitmap[i][8] = 4;
            qrBitmap[8][i + sizeModules - 8] = 4;
            qrBitmap[i + sizeModules - 8][8] = 4;
        }
        qrBitmap[8][8] = 4;

        //VERSION INFORMATION AREA
        for(i = 0; i < 3; i++){
            for(j = 0; j < 6; j++){
                qrBitmap[i + sizeModules - 11][j] = 5;
                qrBitmap[j][i + sizeModules - 11] = 5;
            }
        }

        //ADD DARK MODULE
        qrBitmap[8][sizeModules - 8] = 0;

        //DRAW QR CODE
        this.drawCodeOnCanvas(sizeModules);
        this.drawQRonCanvas(sizeModules, scale, context);
    }

    drawCodeOnCanvas(s){
        console.log(qrBitmap);
        var f = final_codeword_byte;
        var dir = 1;
        var flag = true;
        var i = s-1, j = s-1, count=0;
        var propMode = "up";
        do{
            console.log(dir + " " + i + " " + j);
            qrBitmap[i][j] = 1 - parseInt(f[count]);
            //decide i, j values depending on dir
            if(dir === 1){
                //west
                i -= 1;
            }
            else if(dir === 2){
                //north-east
                i += 1;
                j -= 1;
            }
            else if(dir === 3){
                //south-east
                i += 1;
                j += 1;
            }

            //decide next direction
            if(propMode === "up"){
                dir = 3 - dir;
            }
            count++;
        }while(count < 10);
    }

    drawQRonCanvas(sizeModules,scale, context){
        var i, j, r, color;
        for(i = 0; i < sizeModules ; i++){
            for(j = 0; j < sizeModules ; j++){
                if(qrBitmap[i][j] >= 0){
                    r = qrBitmap[i][j] % 6;
                    switch(r) {
                        case 0 : color = "rgb(0, 0, 0)";
                                break;
                        case 1: color = "rgb(255, 255, 255)";
                                break;
                        case 2 : color = "rgb(0, 0, 0)";
                                break;
                        case 3 : color = "rgb(255, 255, 255)";
                                break;
                        case 4 : color = "rgb(0, 0, 255)";
                            break;
                        case 5 : color = "rgb(255, 0, 0)";
                            break;
                    }
                    this.drawSquare(context, i*scale, j*scale, scale, scale, color);
                }
            }
        }
    }
    drawSquare(context, startX, startY, width, height, color){
        context.fillStyle = color;
        context.beginPath();
        context.moveTo(startX, startY);
        context.lineTo(startX + width, startY);
        context.lineTo(startX + width, startY + height);
        context.lineTo(startX, startY + height);
        context.lineTo(startX, startY);
        context.fill();
        context.closePath();
    }

    componentDidMount(){
        //GENERATE DATA CODE
        this.decideVersion();
        this.decideCharCountIndicatorLength();
        this.decideCharCountIndicator();
        encodedMessageString += mode_indicator;
        encodedMessageString += character_count_indicator;
        this.encodeMessage();
        this.padMessage();
        console.log("encoded message string in binary : " + encodedMessageString);

        //GENERATE REED-SOLOMON ERROR CODE
        this.generateLogAntilogTable();
        data_codeword = this.generateMessagePolynomial();
        this.generateGeneratorPolynomial();
        //divide message polynomial by generator polynomial to get error codes
        error_correction_codeword = this.generateErrorCorrectionCodewords();
        console.log("data codeword : " + data_codeword);
        console.log("error correction codeword: " + error_correction_codeword);
        this.structureFinalMessage();
        this.drawQR();
    }
    render(){
        return (
            <div>
                <canvas id="qrCanvas" />
            </div>
        )
    }
}