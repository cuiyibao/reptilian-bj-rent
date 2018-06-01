import fs from 'fs' // node的文件模块，用于将筛选后的数据输出为html
import path from 'path' // node的路径模块，用于处理文件的路径

//  以下模块非node.js自带模块，需要使用npm安装

// 客户端请求代理模块
import superagent from "superagent"
// node端操作dom的利器，可以理解成node版jQuery，语法与jQuery几乎一样
import cheerio from "cheerio"
// 通过事件来决定执行顺序的工具，下面用到时作详解
import eventproxy from 'eventproxy'
//  async是一个第三方node模块，mapLimit用于控制访问频率
import async from "async"

let ep = new eventproxy() //  实例化eventproxy

let baseUrl = 'https://www.douban.com/group/beijingzufang/discussion?start=';
let pageUrls = [] // 要抓取的页面数组

let page = 10 // 抓取页面数量
let perPageQuantity = 25 //  每页数据条数

for (let i = 0; i < page; i++) {
    pageUrls.push({
        url: baseUrl + i * perPageQuantity
    });
}

function filerContent() {
    //  我们设置三个全局变量来保存一些数据
    let result = [] //  存放最终筛选结果
    let authorMap = {} // 我们以对象属性的方式，来统计每个的发帖数
    let intermediary = [] // 中介id列表，你也可以把这部分数据保存起来，以后抓取的时候直接过滤掉！

    // 还记得之前的ep.emit()吗，它的每次emit都被这里捕获。ep.after('事件名称',数量,事件达到指定数量后的callback())。
    // 也就是说，总共有20*25（页面数*每页数据量）个事件都被捕获到以后，才会执行这里的回调函数
    ep.after('preparePage', pageUrls.length * page, function(data) {
        console.log('事件监听之后' + data.length);
        // 这里我们传入不想要出现的关键词，用'|'隔开 。比如排除一些位置，排除中介常用短语
        let filterWords = /押一付一|短租|月付|蛋壳|有房出租|6号线|六号线/
            // 这里我们传入需要筛选的关键词，如没有，可设置为空格
        let keyWords = /西二旗/
            // 我们先统计每个人的发帖数，并以对象的属性保存。这里利用对象属性名不能重复的特性实现计数。
        data.forEach(item => {
                authorMap[item.author] = authorMap[item.author] ? ++authorMap[item.author] : 1
                if (authorMap[item.author] > 4) {
                    intermediary.push(item.author) // 如果发现某个人的发帖数超过5条，直接打入冷宫。
                }
            })
            // 数组去重，Set去重了解一下，可以查阅Set这种数据结构
        intermediary = [...new Set(intermediary)]
            // 再次遍历抓取到的数据
        data.forEach(item => {
            //这里if的顺序可是有讲究的，合理的排序可以提升程序的效率
            if (item.markSum > 100) {
                console.log('评论过多，丢弃')
                return
            }
            if (filterWords.test(item.title)) {
                console.log('标题带有不希望出现的词语')
                return
            }
            if (intermediary.includes(item.author)) {
                console.log('发帖数过多，丢弃')
                return
            }
            //  只有通过了上面的层层检测，才会来到最后一步，这里如果你没有设期望的关键词，筛选结果会被统统加到结果列表中
            // if (keyWords.test(item.title)) {
            result.push(item)
                // }
        })

        //  设置html模板
        let top = '<!DOCTYPE html>' +
            '<html lang="en">' +
            '<head>' +
            '<meta charset="UTF-8">' +
            '<style>' +
            '.listItem{ display:block;margin-top:10px;text-decoration:none;}' +
            '.markSum{ color:red;}' +
            '.lastModify{ color:"#aaaaaa"}' +
            '</style>' +
            '<title>筛选结果</title>' +
            '</head>' +
            '<body style="margin:30px 40px;text-align:center;">' +
            '<div>'
        let bottom = '</div> </body> </html>'

        // 拼装有效数据html
        let content = ''

        result.forEach(function(item) {
            content += `<a class="listItem" href="${item.url}" target="_blank">${item.title}_____<span class="markSum">${item.markSum}</span>____<span class="lastModify">${item.lastModify}</span>`
        })

        let final = top + content + bottom

        console.log('开始写入文件')
            //   最后把生成的html输出到指定的文件目录下
        fs.writeFile(path.join(__dirname, '../tmp/result.html'), final, function(err) {
            if (err) {
                return console.error(err);
            }
            console.log('success')
                // questRes.send("<h1>抓取完毕</h1></br><a href='/result'><button>跳转</button></a>");
        });
    });
}

export function start() {
    filerContent()
        //并发连接数的计数器
    var concurrencyCount = 0;
    var fetch = function(pageItem, callback) {
        console.time('  耗时');
        concurrencyCount++;
        superagent.get(pageItem.url)
            // 模拟浏览器
            .set('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/65.0.3325.181 Safari/537.36')
            //  如果你不乖乖少量爬数据的话，很可能被豆瓣kill掉，这时候需要模拟登录状态才能访问
            .set('Cookie', '_pk_ref.100001.8cb4=%5B%22%22%2C%22%22%2C1527836221%2C%22http%3A%2F%2F127.0.0.1%3A8904%2Fresult%2F%22%5D; _pk_id.100001.8cb4=0bfe49eb04f8e203.1527836213.1.1527836221.1527836213.; _pk_ses.100001.8cb4=*;')
            .end(function(err, res) {
                console.log('并发数:', concurrencyCount--, 'fetch', pageItem);
                let $ = cheerio.load(res.text) // 将页面数据用cheerio处理，生成一个类jQuery对象

                let itemList = $('.olt tbody').children().slice(1, 26) // 取出table中的每行数据，并过滤掉表格标题

                // 遍历页面中的每条数据
                for (let i = 0; i < itemList.length; i++) {
                    let item = itemList.eq(i).children()

                    let title = item.eq(0).children('a').text() || '' // 获取标题
                    let url = item.eq(0).children('a').attr('href') || '' // 获取详情页链接
                        // let author = item.eq(1).children('a').attr('href').replace('https://www.douban.com/people', '').replace(/\//g, '') || ''  // 获取作者id
                    let author = item.eq(1).children('a').text() || '' // 这里改为使用作者昵称而不是id的原因是发现有些中介注册了好多账号，打一枪换个地方。虽然同名也有，但是这么小的数据量下，概率低到忽略不计
                    let markSum = item.eq(2).text() // 获取回应数量
                    let lastModify = item.eq(3).text() // 获取最后修改时间

                    let data = {
                            title,
                            url,
                            author,
                            markSum,
                            lastModify
                        }
                        // ep.emit('事件名称', 数据内容)
                    ep.emit('preparePage', data) // 每处理完一条数据，便把这条数据通过preparePage事件发送出去，这里主要是起计数的作用
                    callback(null, [pageItem, res.text]);
                }
            });

    }
    async.mapLimit(pageUrls, 50, function(pageUrls, callback) {
        fetch(pageUrls, callback);
        console.timeEnd("  耗时");
    }, function(err, result) {
        // questRes.send(result)
        // console.log('final:\n', result);
    });
}

export function start2() {
    superagent.get('https://www.douban.com/group/beijingzufang/discussion?start=0')
        // 模拟浏览器
        .set('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/65.0.3325.181 Safari/537.36')
        //  如果你不乖乖少量爬数据的话，很可能被豆瓣kill掉，这时候需要模拟登录状态才能访问
        .set('Cookie', '_pk_ref.100001.8cb4=%5B%22%22%2C%22%22%2C1527836221%2C%22http%3A%2F%2F127.0.0.1%3A8904%2Fresult%2F%22%5D; _pk_id.100001.8cb4=0bfe49eb04f8e203.1527836213.1.1527836221.1527836213.; _pk_ses.100001.8cb4=*;')
        .end(function(err, res) {
            console.log(res)
                //var $ = cheerio.load(res.text);
                // questRes.send(res.text)
        });
}