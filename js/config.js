var PageUrlRex = /^(http|ftp|https):\/\/[\w\-_]+(\.[\w\-_]+)+([\w\-\.,@?^=%&amp;:/~\+#]*[\w\-\@?^=%&amp;/~\+#])?$/;
var DomainHeadRex = /^(http|ftp|https):\/\/[\w\-_]+(\.[\w\-_]+)/;

var NextPageNames = ["next", "nextpage","next-page", "next_page", "下一页", "下页", "翻页", "次のページ", "次ページ", "次"];
var NextPageSigns = ["..", "...", ">","\u8250", ">>", ">|", ">||", ">>|", ">>||"];

var ImageTypes = /\.(jpg|jpeg|png|gif|tga|exif|pcx|tiff|fpx|svg|psd)/i;

var ImageLoadFailed = {
    url : "css/error.jpg",
    width : 220,
    height : 220,
};