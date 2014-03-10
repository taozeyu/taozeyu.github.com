/* SynchroBuffer 生产者——消费者模式的同步缓存。
 * 
 * 通过 Y.SynchroBuffer.create(depthCount) 建立同步节点。
 * @param depthCount 是深度，缓存区中缓存的对象超过该值时，生产者就不会继续生产了。
 * 
 * 同步节点有如下方法可以调用：
 * 
 * .add(obj, continueFun);
 * 生产者调用的方法，用于向消费者异步传递产物obj。
 * @param obj 要传递的产物，如果是数组，则自动拆分传递。
 * @param continueFun 一个回调函数。当同步节点认为生产者可以继续生产时，会调用该函数。
 *              具体说，当缓存未满慢，会立即调用，当缓存满时，会等待消费者消费掉部分直到缓存未满才调用。
 *
 * .get(continueFun);
 * 消费者调用的方法，消费者用此方法来获取传递产物obj。
 * @param continueFun(state, obj) 一个回调函数。当参数state==Y.Synchro.Success时，obj用于接收生产者传递来的产物。
 *                      当缓存区非空时，会立即调用该函数获得产物。否则，将等待生产者传递来产物后才回调。
 *                      如果已经不可能得到产物了，会返回state==Y.Synchro.Finished。
 *                      （生产者调用finish，且缓存中没有产物时。）
 *
 * .getMany(num, continueFun);
 * 消费者调用的方法，原理同.get()。只不过只有等到获取满num个产物时才会回调continueFun。
 * @continueFun(state, arrObj) 参数同.get()方法，但arrObj是一个产物数组，而非一个产物。
 *                             state==Y.Synchro.Success 表明 num 个产物全部获得。
 *                             state==Y.Synchro.Finished 表明部分或全 num 个产物未获得成功，因为已经finished！
 *
 * .waitUntilAdd(continueFun);
 * @param continueFun 一个回调函数。当缓存区未满时会被调用。（如果现在就未满，则立即调用）
 * 
 * .finish();
 * 由生产者调用的方法，表明生产已经结束，不会有新的产物被加入缓存。
 * 当本方法被调用后，.add()、.waitUntilAdd()方法将不能被调用（如果调用，则throw "finished"。）
 * 此后，当缓存中所有的产物都被消费后，如果消费者再试图调用.get()，则会返回false。
 */
YUI.add("synchro-buffer", function(Y){
    
    var Success = "success";
    var Finished = "finished";
    
    var create = function(depthCount) {
        if(!depthCount) {
            depthCount = 15;
        }
        var finish = false;
        var buffer = {depthCount: depthCount};
        var queue = [];
        var producerQueue = [];
        var consumerQueue = [];
        
        var keepLoop = true;
        
        var callGet = function() {
            if(consumerQueue.length > 0 && queue.length > 0) {
                var callBack = consumerQueue.shift();
                var obj = queue.shift();
                try {
                    callBack(Success, obj);
                } catch (err) {
                    //异常抛出可能导致整个生产链停滞，必须吃掉异常。
                    Y.log.error(err);
                }
                return true;
            }
            return false;
        };
        
        var callAdd = function() {
            if(producerQueue.length > 0 && queue.length < depthCount) {
                var callBack = producerQueue.shift();
                try {
                    callBack();
                } catch (err) {
                    //异常抛出可能导致整个生产链停滞，必须吃掉异常。
                    Y.log.error(err);
                }
                return true;
            }
            return false;
        };
        
        var clearConsumerQueue = function() {
            while(consumerQueue.length > 0) {
                var callBack = consumerQueue.shift();
                try {
                    callBack(Finished);
                } catch (err) {
                    //异常抛出可能导致整个生产链停滞，必须吃掉异常。
                    Y.log.error(err);
                }
            }
        };
        
        /* 【主驱动循环】
         * 设置此循环是因为，在生产者——消费者模式中，虽然简单调用回调函数在逻辑上没有任何问题，
         * 但是，却可能导致过深的递归，从而stack overflow。
         * 设置主循环的目的是，最外层的 add()和 get()调用才会触发驱动主循环，而在循环内回调方法中调用
         * add()和get()是不会进入主循环，而是直接返回。
         * 
         * 因此，生产者——消费者之间的拉锯将仅仅变成驱动循环一遍一遍的运行，而非无穷无尽的递归。
         *
         * 特别的，主循环中无论生产者，还是消费者，无论是谁无法继续，循环都会break。这也是很符合逻辑的。
         * 另外，无论是add()还是get()，循环中都应该先callGet()。
         */
        var driveLoop = function() {
            while(keepLoop) {
                keepLoop = false;
                try {
                    if(finish && producerQueue.length <= 0) {
                        //生产者已经宣布停产，而缓存空了，此时应该回调所有正在等待的消费者，告诉他们finished！
                        clearConsumerQueue();
                        break;
                    }
                    if(!callGet()) {
                        break;
                    }
                    if(!callAdd()) {
                        break;
                    }
                } finally {
                    keepLoop = true;
                    break;
                }
            }
        };
        
        buffer.add = function(obj, continueFun) {
            if(finish) {
                throw "finished"
            }
            if(obj) {
                queue.push(obj);
            }
            if(continueFun) {
                producerQueue.push(continueFun);
            }
            driveLoop();
        };
        
        buffer.waitUntilAdd = function(continueFun) {
            buffer.add(null, continueFun);
        };
        
        buffer.finish = function() {
            if(finish) {
                throw "finished";
            }
            finish = true;
            driveLoop();
        };
        
        buffer.get = function(continueFun) {
            if(!continueFun) {
                throw "continueFun can not be null";
            }
            consumerQueue.push(continueFun);
            driveLoop();
        }
        
        buffer.getMany = function(num, continueFun) {
            var rsObj = {};
            var fun = function() {
                if(rsObj.length < num) {
                    buffer.get(function(state, obj) {
                        if(state==Success) {
                            rsObj.push(obj);
                            fun();
                        } else {
                            continueFun(state, sendObj);
                        }
                    });
                } else {
                    continueFun(Success, sendObj);
                }
            };
            fun();
        };
        return buffer;
    };

    Y.SynchroBuffer = {
        create : create,
        Success : Success,
        Finished : Finished,
    };
});