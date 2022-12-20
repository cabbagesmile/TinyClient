// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

var fs = require('fs')
var inDir = ''
var outDir = ''
// var inDir = '/Users/user2/Desktop/未命名文件夹'
// var outDir = '/Users/user2/Desktop/Guide'
const electron = require('electron');
const dialog = electron.remote.dialog;
const { BrowserWindow } = require('electron').remote
const shell = electron.shell
const path = require('path')
let keyListArray = new Array()
var tinify = require("tinify");
const { resolve } = require('dns');
const { rejects, match } = require('assert');
const { mainModule } = require('process');
var TinifyKey = '默认值，肯定是查不到，😋';
var errTinifyKeyArr = []; ///已失败的key

var currentKeyValidCount = 0; ///当前key的有效次数
var compressBigCycleCount = 0; ///当前轮番压缩的次数。

main();

async function main() {
    let localKeyList = localStorage.getItem('keyList')
    if (!localKeyList) {
        localKeyList = '33vP4Gk68BpyBfWz8pvt2bF81pjh4pp9,7PHFBVXdqcCMhRjMVF04vQxNYlQrN404,ZlYSYxQG4dVcSLxVb3VrKNCsN3xhPlsS,vPtgGZgfLJXDMzym0kP3j1JfWj9z5NQ6,4K14Zf5ST22MHHZJVX59DLhSkcFmznsF,vD92kpt77T5YnsQS8QPvzBrdtJCg9ZWZ,lqGZ8lSknRTQFz4fQGVf06vgsNSHgM03';
        // localKeyList = '4K14Zf5ST22MHHZJVX59DLhSkcFmznsF,vD92kpt77T5YnsQS8QPvzBrdtJCg9ZWZ,lqGZ8lSknRTQFz4fQGVf06vgsNSHgM03,33vP4Gk68BpyBfWz8pvt2bF81pjh4pp9,7PHFBVXdqcCMhRjMVF04vQxNYlQrN404,ZlYSYxQG4dVcSLxVb3VrKNCsN3xhPlsS,vPtgGZgfLJXDMzym0kP3j1JfWj9z5NQ6';
        localStorage.setItem('keyList', localKeyList);
    }
    localKeyList = localKeyList.split(',')
    ///准备校验key
    var res = await autoSwitchKey();
    if (res) {
        addLog('准备就绪，请选择文件夹(同一目录将会覆盖原图片，请谨慎操作)')
    }
}

// var testKeyInfo = {};
function promiseCheckValidate(key) {
    return new Promise((resolve, reject) => {
        tinify.key = key;
        tinify.validate(err => {
            if (err) {
                resolve({ code: 1, msg: '校验过程出错', count: 0 });
            } else {
                // if(testKeyInfo[key]) {
                //     tinify.compressionCount = 500;
                // } else {
                //     tinify.compressionCount = 499;
                //     testKeyInfo[key]= 1;
                // }
                // console.log('testKey:',testKeyInfo);
                var destCount = 500;
                if (tinify.compressionCount < destCount) {
                    addLog('当前 Key 本月剩余:' + (500 - tinify.compressionCount) + ' 次');
                    resolve({ code: 10000, msg: '', count: (500 - tinify.compressionCount) });
                } else {
                    resolve({ code: 2, msg: '次数超过' + destCount + '次', count: 0 });
                }
            }
        })
    })
}

function promiseReadFile(filePath) {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, (err, sourceData) => {
            resolve({ err, sourceData });
        })
    });
}

function promiseTinyFromBuffer(sourceData) {
    return new Promise((resolve, reject) => {
        tinify.fromBuffer(sourceData).toBuffer((err, resultData) => {
            resolve({ err, resultData });
        });
    })
}


//自动更换key
async function autoSwitchKey() {
    addLog('开始验证 Key')
    let localKeyList = localStorage.getItem('keyList')
    var keyArr = localKeyList.split(',');
    for (var index = 0; index < keyArr.length; index++) {
        var key = keyArr[index];
        if (errTinifyKeyArr.indexOf(key) >= 0) {
            continue;
        }
       addLog('当前的是第' + (index + 1) + '个key:' + key);
        var res = await promiseCheckValidate(key);
        if (res.code == 10000) {
            currentKeyValidCount = res.count;
            TinifyKey = key;
            addLog('校验通过key为：'+ key);
            return true;
        } else {
            errTinifyKeyArr.push(key);
            addLog('校验不通过:' + key + res.msg + ',准备下一个');
        }
    }
    currentKeyValidCount = 0;
    addLog('全都校验不通过，请更新key管理中的值');
    return false;
}

function initList() {
    fs.readdir(inDir, (err, data) => {
        if (err) {
            console.log(err)
            addLog(err)
        }
        console.log(data)
        start(data)
    })
}


async function start(list) {
    currentKeyValidCount = 0;
    compressBigCycleCount = 0;
    //console.log(list)
    //console.log(list.length)
    if (!list || list.length <= 0) {
        addLog('输入目录里面没有检测到待压缩的图片');
        return;
    }
    for (var i = 0; i < list.length; i++) {
        var fileExtension = list[i].substring(list[i].lastIndexOf('.') + 1);
        //console.log(fileExtension)
        if (fileExtension != 'png' && fileExtension != 'jpg') {
            list.splice(i, 1)
        }
    }
    addLog('读取列表完成，共有' + list.length + '个图片')
    compressFiles(list);
}
async function exportErrFiles(files) {
    addLog('准备写入压缩失败的文件：压缩失败文件个数：' + files.length);
    fs.mkdir(outDir + '/压缩失败');
    for (var index = 0; index < files.length; index++) {
        var file = files[index];
        var inFilePath = inDir + '/' + file;
        var outFilePath = outDir + '/压缩失败/' + file;
        var { err, sourceData } = await promiseReadFile(inFilePath);

        if (!err) {
            fs.writeFileSync(outFilePath, sourceData);
        }
    }
}

async function compressFiles(files) {
    addLog('准备处理图片 ⭕️');
    if (compressBigCycleCount > 3) {
        addLog('轮番压缩的次数超过3次了，导出压缩失败的图片');
        exportErrFiles(files);
        addLog('--------😭压缩结束，但有失败---------');
        return;
    }
    compressBigCycleCount++;
    var currentCompleteIndex = 0;
    var errFiles = [];///失败的文件名
    for (var index = 0; index < files.length; index++) {
        let file = files[index];
        let inFilePath = inDir + '/' + file;
        let outFilePath = outDir + '/' + file;
      
        if (currentKeyValidCount <= 0) {
            //获取有效值，如果key无效会自动切换下一个
            var autoSwitchKeyRes = await autoSwitchKey(true);
            if (!autoSwitchKeyRes) {
                compressBigCycleCount = 4; ///直接就不再继续了
                addLog('因为无key可用，加入错误队列');
                errFiles.push(file);
                currentCompleteIndex++;
                if (currentCompleteIndex == files.length) {
                    if (errFiles.length > 0) {
                        addLog('本轮还有' + errFiles.length + '个未成功');
                    }
                    compressFiles(errFiles);
                }
                continue;
            }
        }
        ///读取文件。 
        var { err, sourceData } = await promiseReadFile(inFilePath);
        //消耗了一个可用数
        currentKeyValidCount--;
        console.log('有效值消耗一个，-1:' + currentKeyValidCount);
        //赋值为自动获取后的值
        tinify.key = TinifyKey;
        tinify.fromBuffer(sourceData).toBuffer((err, resultData) => {
            if (err) {
                errFiles.push(file);
                addLog('压缩失败，加入错误队列');
            } else {
                fs.writeFileSync(outFilePath, resultData);
                addLog('压缩成功，写入文件夹', file);
                console.log('文件名：', file)
            }
            currentCompleteIndex++;
            addLog('本轮进度：' + currentCompleteIndex + '/' + files.length);
            if (currentCompleteIndex == files.length) {
                if (errFiles.length > 0) {
                    addLog('本轮还有' + errFiles.length + '个未成功');
                    compressFiles(errFiles);
                } else {
                    addLog('--------😊压缩结束，全部压缩成功---------');
                }
            }
        });
    }
}

// 压缩
var compressionFile = function (nameList) {
    fs.readFile("map_24.png", function (err, sourceData) {
        if (err) {
            errHandle(err)
            return
        };
        tinify.fromBuffer(sourceData).toBuffer(function (err, resultData) {
            if (err) throw err;
            fs.writeFileSync('s.png', resultData);
            addLog('压缩完成')
        });
    });
}

var errHandle = function (err) {
    if (err instanceof tinify.AccountError) {
        addLog("账户错误，Key 该换了: " + err.message);
        // Verify your API key and account limit.
    } else if (err instanceof tinify.ClientError) {
        addLog('客户端错误')
        // Check your source image and request options.
    } else if (err instanceof tinify.ServerError) {
        addLog('服务端错误')
        // Temporary issue with the Tinify API.
    } else if (err instanceof tinify.ConnectionError) {
        addLog('网络错误')
        // A network connection error occurred.
    } else {
        addLog('未知错误')
        // Something else went wrong, unrelated to the Tinify API.
    }
}

document.getElementById('inDir').addEventListener('click', () => {
    dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory']
    }, (res) => {
        if (res) {
            inDir = res[0]
            addLog('当前输入目录:' + res[0])
        }
    });
})

document.getElementById('outDir').addEventListener('click', () => {
    dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory']
    }, (res) => {
        if (res) {
            outDir = res[0]
            addLog('当前输出目录:' + res[0])
        }
    });
})

document.getElementById('start').addEventListener('click', () => {
    if (!inDir) {
        addLog('请选择输入目录')
        return
    }
    if (!outDir) {
        addLog('请选择输出目录')
        return
    }
    initList()
})

document.getElementById('cancel').addEventListener('click', () => {
    document.getElementById('modal').style.display = "none"
})

document.getElementById('keyManage').addEventListener('click', () => {
    document.getElementById('modal').style.display = "block"
    let list = localStorage.getItem('keyList')
    console.log(document.getElementById('keyListInput').children)
    if (list) {
        let listArray = list.split(',')
        for (let i = 0; i < listArray.length; i++) {
            document.getElementById('keyListInput').children[i].value = listArray[i]
        }
    }
})

document.getElementById('confirm').addEventListener('click', () => {
    let inputList = document.getElementById('keyListInput').children
    for (let i = 0; i < inputList.length; i++) {
        console.log(inputList[i].value)
        if (inputList[i].value) {
            keyListArray.push(inputList[i].value)
        }
    }
    localStorage.setItem('keyList', keyListArray.join(','))
    keyListArray = []
    document.getElementById('modal').style.display = 'none'
    checkKey(0)
})

document.getElementById('getKey').addEventListener('click', () => {
    shell.openExternal('https://tinypng.com/developers')
})

function addLog(str) {
    let d = new Date()
    document.getElementById('log').textContent += '\n' + '# ' + str
    document.getElementById('log').scrollTo(0, document.getElementById('log').scrollHeight);
}

Array.prototype.removeByIndex = function (dx) {
    if (isNaN(dx) || dx > this.length) {
        return false;
    }
    this.splice(dx, 1);
}

