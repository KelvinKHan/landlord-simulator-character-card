export const Schema = z.object({
  房东系统: z
    .object({
      版本: z.string().prefault('2.0'),
      运行模式: z.enum(['模拟', '真实']).prefault('模拟'),
      当前建筑ID: z.string().prefault('building_headquarters'),
      用户: z
        .object({
          名称: z.string().prefault('{{user}}'),
          物品栏: z
            .record(
              z.string().describe('物品名'),
              z
                .object({
                  数量: z.coerce.number().transform(value => Math.max(0, value)).prefault(1),
                  描述: z.string().prefault('暂无描述'),
                })
                .prefault({}),
            )
            .prefault({}),
        })
        .prefault({}),
      建筑列表: z
        .record(
          z.string().describe('建筑ID'),
          z
            .object({
              名称: z.string().prefault('未命名建筑'),
              类型: z.string().prefault('自由建筑'),
              世界观: z.string().prefault('跟随当前世界'),
              简介: z.string().prefault('暂无介绍'),
              是否总部: z.boolean().prefault(false),
              接管状态: z.enum(['总部', '已接管', '可接管', '未发现']).prefault('未发现'),
              感知度: z.coerce
                .number()
                .transform(value => Math.max(0, Math.min(100, value)))
                .prefault(0),
              主题: z
                .object({
                  图标: z.string().prefault('building'),
                  主色: z.string().prefault('#FF9EAA'),
                  辅色: z.string().prefault('#FFB7B2'),
                  纹理: z.string().prefault('soft-grid'),
                })
                .prefault({}),
              经营摘要: z
                .object({
                  等级: z.coerce.number().transform(value => Math.max(1, value)).prefault(1),
                  活跃度: z.coerce
                    .number()
                    .transform(value => Math.max(0, Math.min(100, value)))
                    .prefault(0),
                  入住率: z.coerce
                    .number()
                    .transform(value => Math.max(0, Math.min(100, value)))
                    .prefault(0),
                  今日亮点: z.string().prefault('一切正在等待新的故事'),
                })
                .prefault({}),
              楼层列表: z
                .record(
                  z.string().describe('楼层ID'),
                  z
                    .object({
                      名称: z.string().prefault('未命名楼层'),
                      顺序: z.coerce.number().prefault(0),
                      感知度: z.coerce
                        .number()
                        .transform(value => Math.max(0, Math.min(100, value)))
                        .prefault(100),
                      描述: z.string().prefault('暂无描述'),
                    })
                    .prefault({}),
                )
                .prefault({}),
              空间列表: z
                .record(
                  z.string().describe('空间ID'),
                  z
                    .object({
                      名称: z.string().prefault('未命名空间'),
                      类型: z.string().prefault('空置空间'),
                      楼层ID: z.string().prefault('floor_ground'),
                      尺寸: z.enum(['微型', '小型', '中型', '大型', '超大型']).prefault('中型'),
                      状态: z.enum(['正常', '空置', '装修中', '待修复', '未知']).prefault('正常'),
                      用途: z.string().prefault('等待规划'),
                      描述: z.string().prefault('暂无描述'),
                      感知度: z.coerce
                        .number()
                        .transform(value => Math.max(0, Math.min(100, value)))
                        .prefault(100),
                      相邻空间: z
                        .record(z.string().describe('相邻空间ID'), z.string().prefault('相连'))
                        .prefault({}),
                      占用者: z
                        .record(z.string().describe('人物ID'), z.string().prefault('使用者'))
                        .prefault({}),
                      设施: z
                        .record(
                          z.string().describe('设施ID'),
                          z
                            .object({
                              名称: z.string().prefault('未命名设施'),
                              状态: z.enum(['良好', '普通', '待修复', '停用']).prefault('普通'),
                              描述: z.string().prefault('暂无描述'),
                            })
                            .prefault({}),
                        )
                        .prefault({}),
                      装修: z
                        .object({
                          风格: z.string().prefault('基础装修'),
                          配色: z.record(z.string().describe('色彩用途'), z.string()).prefault({}),
                          材质: z.record(z.string().describe('部位'), z.string()).prefault({}),
                          家具: z.record(z.string().describe('家具ID'), z.string()).prefault({}),
                          照明: z.string().prefault('自然柔光'),
                          氛围: z.string().prefault('舒适'),
                          完成度: z.coerce
                            .number()
                            .transform(value => Math.max(0, Math.min(100, value)))
                            .prefault(0),
                        })
                        .prefault({}),
                    })
                    .prefault({}),
                )
                .prefault({}),
            })
            .prefault({}),
        )
        .prefault({}),
      人物列表: z
        .record(
          z.string().describe('人物ID'),
          z
            .object({
              姓名: z.string().prefault('未命名人物'),
              来源世界: z.string().prefault('当前世界'),
              身份类型: z.string().prefault('租客'),
              职业: z.string().prefault('暂无'),
              所在建筑ID: z.string().prefault('building_headquarters'),
              所在空间ID: z.string().prefault(''),
              外貌: z.string().prefault('待补充'),
              性格: z.string().prefault('待补充'),
              状态: z.string().prefault('正常'),
              内心: z.string().prefault('平静'),
              感知度: z.coerce
                .number()
                .transform(value => Math.max(0, Math.min(100, value)))
                .prefault(100),
              视觉身份: z
                .object({
                  图标: z.string().prefault('person'),
                  主色: z.string().prefault('#FF9EAA'),
                  纹样: z.string().prefault('dots'),
                })
                .prefault({}),
              生活状态: z
                .object({
                  空间契合度: z.coerce.number().transform(value => Math.max(0, Math.min(100, value))).prefault(0),
                  当前感受: z.string().prefault('尚未形成明确感受'),
                  偏好线索: z.record(z.string().describe('偏好标签'), z.string()).prefault({}),
                  最近空间ID: z.string().prefault(''),
                  反应键: z.string().prefault(''),
                })
                .prefault({}),
              关系: z.record(z.string().describe('人物ID'), z.string()).prefault({}),
            })
            .prefault({}),
        )
        .prefault({}),
      事件列表: z
        .record(
          z.string().describe('事件ID'),
          z
            .object({
              标题: z.string().prefault('未命名事件'),
              类型: z.string().prefault('日常'),
              建筑ID: z.string().prefault('building_headquarters'),
              空间ID: z.string().prefault(''),
              状态: z.enum(['待处理', '进行中', '已完成', '已忽略']).prefault('待处理'),
              摘要: z.string().prefault('暂无摘要'),
              发生时间: z.string().prefault('刚刚'),
              场景键: z.string().prefault(''),
              参与者: z.record(z.string().describe('人物ID'), z.string().prefault('参与')).prefault({}),
            })
            .prefault({}),
        )
        .prefault({}),
      联动队列: z
        .record(
          z.string().describe('联动项ID'),
          z
            .object({
              事件ID: z.string().prefault(''),
              频道: z.enum(['正文', '微信', '新闻', '建筑']).prefault('建筑'),
              标题: z.string().prefault('未命名联动'),
              摘要: z.string().prefault('暂无摘要'),
              建筑ID: z.string().prefault('building_headquarters'),
              空间ID: z.string().prefault(''),
              人物ID: z.string().prefault(''),
              来源类型: z.string().prefault('日常'),
              状态: z.enum(['待分发', '已读取', '已忽略']).prefault('待分发'),
              创建时间: z.string().prefault('刚刚'),
              上下文: z.record(z.string(), z.string()).prefault({}),
            })
            .prefault({}),
        )
        .prefault({}),
    })
    .prefault({}),
});
