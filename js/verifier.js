/* Verifier 验证器：
 * 
 * 引用，使用YUI.use("verifier" function(){...});
 * 本库只有一个方法 Y.Verifier(...);
 *
 * 当作为单值验证时：
 * var verifier = Y.Verifier().above(5).under(10) 建立一个 5 < x < 10 的验证器。
 * verifier(7) => true, verifer(11) => false
 * verifier.assert(7) => pass, verifer.assert(11) throw error
 * 
 * 使用or连接：
 * Y.Verifier().equal(3).or().equal(6).or().equal(9) 对于3、6、9 都可以通过验证。
 *
 * 使用not修饰：
 * Y.Verifier().not().equal("good") 只要不是"good"都可以通过验证。
 * 
 * 使用otherwise修饰：
 * var verifier = Y.Verifier().under(12).otherwise("password is too long");
 * verifier.assert("woaibeijingtiananmen".length); => throw "password is too long"
 *
 * 作为参数验证器：
 * var verifier = Y.Verifier({
 *      age : Y.Verifier().between(15, 18),
 *      name : Y.Verifier().not().blank().otherwise("name can't be blank!"),
 * });
 * verifier({
 *      age : 17,
 *      name : "feng wen tao",
 * }); => return true...
 * verifier.assert({
 *      age : 18,
 *      name : "",
 * }); => throw "name can't be blank!"
 *
 * 列表：
 * equal ==
 * above >
 * under <
 * between a1-a2
 * lengthBetween str.length 属于 a1-a2
 * blank null 或 空字符串（包括用纯粹用空填充的字符串）
 */
YUI.add("verifier", function(Y){
    
    var equalVerifer = function(obj, args) {
        return obj == args[0];
    }
    
    var aboveVerifier = function(obj, args) {
        return obj > args[0];
    };
    
    var underVerifier = function(obj, args) {
        return obj < args[0];
    };
    
    var betweenVerifier = function(obj, args) {
        var a1 = args[0];
        var a2 = args[2];
        if(a1 > a2) {
            var temp = a1;
            a2 = a1;
            a1 = temp;
        }
        return obj >= a1 && obj <= a2;
    }
    
    var lengthBetweenVerifer = function(obj, args) {
        return betweenVerifier(obj.length, args);
    }
    
    var blankVerifer = function(obj) {
        if(obj==0 || obj==0.0) {
            return true;
        }
        if(obj) {
            if(obj.constructor == String) {
                return obj.replace(/\s+/, "").length==0;
            }
            return false;
        }
        return true;
    };
    
    var integerInterceptor = function(obj, args) {
        if(obj==undefined) {
            if(args[0]) {
                return args[0];
            } else {
                throw "不是整数！";
            }
        }
        if(obj.constructor==Number) {
            return obj;
        } else if (obj.constructor==String) {
            try {
                if(args[0] && obj.replace(/\s+/, "")=="") {
                    return args[0];
                }
                return parseInt(obj);
            } catch(err) {
                throw "不是整数!"
            }
        }
        throw "不是整数！";
    };
    
    var boolInterceptor = function(obj, args) {
        if(obj==undefined) {
            throw "不是布尔";
        }
        if(typeof(obj)=="boolean") {
            return obj;
        }
        else if(obj.constructor==Number) {
            return obj!=0;
        }
        else if (obj.constructor==String) {
            if(obj.test(/^\s*true$\s*/i)) {
                return true;
            } else if(obj.test(/^\s*false$\s*/i)) {
                return false;
            }
        }
        throw "不是布尔";
    }
    var registerVerifer = function(store, fun, args) {
        var list = store.list;
        list = list[list.length - 1];
        var verifer = fun;
        if(store.notMark) {
            store.notMark = false;
            verifer = function(obj, args) {
                return !fun(obj, args);
            };
        }
        list.push({
            verifier : verifer,
            args : args,
        });
        return store;
    };
    
    var registerInterceptor = function(store, fun, args) {
        if(store.list[0].length > 0) {
            throw "interceptor muse def before any verifiers."
        }
        var interceptors = store.interceptors;
        interceptors.push({
            interceptor : fun,
            args : args,
        });
        return store;
    }
    
    var registerOr = function(store) {
        if(store.notMark) {
            throw "or() can not be after not()";
        }
        var list = store.list;
        
        if(list[list.length - 1].length == 0) {
            throw "or() must be after some conditions.";
        } else {
            list.push([]);
        }
        return store;
    }
    
    var registerOtherwise = function(store, msg) {
        if(!msg) {
            throw "otherwise must describe something.";
        }
        if(store.notMark) {
            throw "otherwise() can not be after not()";
        }
        var interceptors = store.interceptors;
        var list = store.list;
        list = list[list.length - 1];
        
        if(list.length == 0 && interceptors.length==0) {
            throw "otherwise(), must be after some conditions.";
        }
        if(store.list[0].length==0 && interceptors.length > 0) {
            interceptors[interceptors.length - 1].msg = msg;
        } else {
            list[list.length - 1].msg = msg;
        }
        return store;
    };
    
    var veriferAssert = function(obj, list, interceptors) {
        for(var i=0; i<interceptors.length; ++i) {
            var it = interceptors[i];
            try{
                obj = it.interceptor(obj, it.args);
            } catch(err) {
                if(it.msg) {
                    throw msg;
                } else {
                    throw err;
                }
            }
        }
        notpassMsgs = [];
        for(i=0; i<list.length; ++i) {
            var rs = true;
            loop:for(var j=0; j<list[i].length; ++j) {
                var node = list[i][j];
                if(!node.verifier(obj, node.args)) {
                    rs = false;
                    if(node.msg) {
                        notpassMsgs.push(node.msg);
                    }
                    break loop;
                }
            }
            if(rs) {
                return obj;//pass!!
            }
        }
        if(notpassMsgs.length==0) {
            throw "not pass";
        } else if(notpassMsgs.length==1) {
            throw notpassMsgs[0];
        } else {
            throw notpassMsgs;
        }
    }
    
    var buildParamsVerifer = function(conditions) {
        var rsFun = function(params) {
            for(var c in conditions) {
                if(!conditions[p](params[c])){
                    return false;
                }
            }
            return true;
        }
        rsFun.assert = function(params) {
            for(var c in conditions) {
                conditions.assert(params[c]);
            }
        }
        rsFun.each = function(fun) {
            for(var name in conditions) {
                fun(name, conditions[name]);
            }
        };
        return rsFun;
    }
    
    var buildVerifierCondition = function() {
        var veriferFunction = function(obj) {
            try{
                veriferAssert(obj, veriferFunction.list, veriferFunction.interceptors);
            } catch (err) {
                return false;
            }
            return true;
        };
        veriferFunction.assert = function(obj) {
            return veriferAssert(obj, veriferFunction.list, veriferFunction.interceptors);
        }
        veriferFunction.list = [[]];
        veriferFunction.interceptors = [];
        veriferFunction.notMark = false;
        
        veriferFunction.above = function() {
            return registerVerifer(veriferFunction, aboveVerifier, arguments);
        };
        veriferFunction.under = function() {
            return registerVerifer(veriferFunction, underVerifier, arguments);
        };
        veriferFunction.equal = function() {
            return registerVerifer(veriferFunction, equalVerifer, arguments);
        };
        veriferFunction.between = function() {
            return registerVerifer(veriferFunction, betweenVerifer, arguments);
        };
        veriferFunction.lengthBetween = function() {
            return registerVerifer(veriferFunction, lengthBetweenVerifer, arguments);
        };
        veriferFunction.blank = function() {
            return registerVerifer(veriferFunction, blankVerifer, arguments);
        };
        //----//
        veriferFunction.integer = function() {
            return registerInterceptor(veriferFunction, integerInterceptor, arguments);
        };
        veriferFunction.bool = function() {
            return registerInterceptor(veriferFunction, boolInterceptor, arguments);
        };
        //----//
        veriferFunction.or = function() {
            return registerOr(veriferFunction);
        };
        veriferFunction.otherwise = function(msg) {
            return registerOtherwise(veriferFunction, msg);
        };
        veriferFunction.not = function() {
            veriferFunction.notMark = !veriferFunction.notMark;
            return veriferFunction;
        };
        return veriferFunction;
    };
    
    Y.Verifier = function(conditions) {
        if(conditions) {
            return buildParamsVerifer(conditions);
        } else {
            return buildVerifierCondition();
        }
    };
});