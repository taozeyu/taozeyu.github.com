/* Verifier ��֤����
 * 
 * ���ã�ʹ��YUI.use("verifier" function(){...});
 * ����ֻ��һ������ Y.Verifier(...);
 *
 * ����Ϊ��ֵ��֤ʱ��
 * var verifier = Y.Verifier().above(5).under(10) ����һ�� 5 < x < 10 ����֤����
 * verifier(7) => true, verifer(11) => false
 * verifier.assert(7) => pass, verifer.assert(11) throw error
 * 
 * ʹ��or���ӣ�
 * Y.Verifier().equal(3).or().equal(6).or().equal(9) ����3��6��9 ������ͨ����֤��
 *
 * ʹ��not���Σ�
 * Y.Verifier().not().equal("good") ֻҪ����"good"������ͨ����֤��
 * 
 * ʹ��otherwise���Σ�
 * var verifier = Y.Verifier().under(12).otherwise("password is too long");
 * verifier.assert("woaibeijingtiananmen".length); => throw "password is too long"
 *
 * ��Ϊ������֤����
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
 * �б�
 * equal ==
 * above >
 * under <
 * between a1-a2
 * lengthBetween str.length ���� a1-a2
 * blank null �� ���ַ����������ô����ÿ������ַ�����
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
        var list = store.list;
        list = list[list.length - 1];
        
        if(list.length == 0) {
            throw "otherwise(), must be after some conditions.";
        }
        list[list.length - 1].msg = msg;
        return store;
    };
    
    var veriferAssert = function(obj, list) {
        notpassMsgs = [];
        for(var i=0; i<list.length; ++i) {
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
                return;//pass!!
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
        return rsFun;
    }
    
    var buildVerifierCondition = function() {
        var veriferFunction = function(obj) {
            try{
                veriferAssert(obj, veriferFunction.list);
            } catch (err) {
                return false;
            }
            return true;
        };
        veriferFunction.assert = function(obj) {
            return veriferAssert(obj, veriferFunction.list);
        }
        veriferFunction.list = [[]];
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