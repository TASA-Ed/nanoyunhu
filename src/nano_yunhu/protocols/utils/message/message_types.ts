export interface TSendMessage {
	msgId?: string; // 信息 ID
	chatId?: string; // 欲发送到的信息对象
	chatType?: string; // 欲发送到的信息对象的类别 (uint64)
	data?: SendMessage.Data;
	contentType?: string; // 信息类别 (uint64)
	commandId?: string; // 所使用命令 ID (uint64)
	quoteMsgId?: string; // 引用信息 ID
	media?: SendMessage.Media;
}

export namespace SendMessage {
	export interface Data {
		text?: string; // 信息文本
		buttons?: string; // 按钮
		fileName?: string; // 欲发送文件名称
		fileKey?: string; // 欲发送文件 key
		mentionedId?: string[]; // @对象 ID ,可以填写多个
		form?: string; // 表单消息
		quoteMsgText?: string; // 引用信息文本
		image?: string; // 欲发送图片 key/url(expression/abcdef.jpg)
		postId?: string; // 文章ID
		postTitle?: string; // 文章标题
		postContent?: string; // 文章内容
		postType?: string; // 文章类型:1-文本,2-Markdown
		expressionId?: string; // 个人表情ID(不知道为啥为STR)
		quoteImageUrl?: string; // 引用图片直链,https://...
		quoteImageName?: string; // 引用图片文件名称
		fileSize?: string; // 欲发送文件大小 (uint64)
		video?: string; // 欲发送视频 key/url(123.mp4)
		audio?: string; // 语音 key/url(123.m4a)
		audioTime?: string; // 语音秒数 (uint64)
		quoteVideoUrl?: string; // 引用视频直链,https://...
		quoteVideoTime?: string; // 引用视频时长 (uint64)
		stickerItemId?: string; // 表情 ID (uint64)
		stickerPackId?: string; // 表情包 ID (uint64)
		roomName?: string; // 语音房间发送显示信息的文本
	}

	export interface Media {
		fileKey?: string; // 发送对象 key (就是上传后七牛对象存储给你返回的 file_key)
		fileHash?: string; // 发送对象上传返回哈希
		fileType?: string; // 发送对象类别，image/jpeg-图片，video/mp4-音频
		imageHeight?: string; // 图片高度 (uint64)
		imageWidth?: string; // 图片宽度 (uint64)
		fileSize?: string; // 发送对象大小 (uint64)
		fileKey2?: string; // 发送对象key,和1一样,据说不写会报错
		fileSuffix?: string; // 发送对象后缀名
	}
}
