import express from 'express'
import superagent from "superagent"
import { start2 } from './src/douban'
import boke from './src/boke'
import { getXrsf, getLoginCookie } from './src/getCookie'

let app = express();

app.use('/tmp', express.static('tmp'));

app.get('/', function(req, res) {
    // console.log(req.headers.cookie);
    res.sendFile(__dirname + "/tmp/" + "result.html");
    // getXrsf()
    // boke(res)
})


let server = app.listen(8905, function() {


    let host = server.address().address
    let port = server.address().port

    console.log("应用实例，访问地址为 http://%s:%s", host, port)

    // 开始爬取
    start2()

})