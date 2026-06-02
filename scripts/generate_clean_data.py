import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PDF_SOURCE = Path(r"C:\Users\13273\Desktop\数据.pdf")
TARGET = ROOT / "src" / "data" / "data.json"


SURVEY_TREE = {
    "00": ("湿地", [("0303", "红树林地"), ("0304", "森林沼泽"), ("0306", "灌丛沼泽"), ("0402", "沼泽草地"), ("0603", "盐田"), ("1105", "沿海滩涂"), ("1106", "内陆滩涂"), ("1108", "沼泽地")]),
    "01": ("耕地", [("0101", "水田"), ("0102", "水浇地"), ("0103", "旱地")]),
    "02": ("园地", [("0201", "果园"), ("0202", "茶园"), ("0203", "橡胶园"), ("0204", "其他园地")]),
    "03": ("林地", [("0301", "乔木林地"), ("0302", "竹林地"), ("0305", "灌木林地"), ("0307", "其他林地")]),
    "04": ("草地", [("0401", "天然牧草地"), ("0403", "人工牧草地"), ("0404", "其他草地")]),
    "05": ("商业服务业用地", [("05H1", "商业服务业设施用地"), ("0508", "物流仓储用地")]),
    "06": ("工矿用地", [("0601", "工业用地"), ("0602", "采矿用地")]),
    "07": ("住宅用地", [("0701", "城镇住宅用地"), ("0702", "农村宅基地")]),
    "08": ("公共管理与公共服务用地", [("08H1", "机关团体新闻出版用地"), ("08H2", "科教文卫用地"), ("0809", "公用设施用地"), ("0810", "公园与绿地")]),
    "09": ("特殊用地", []),
    "10": ("交通运输用地", [("1001", "铁路用地"), ("1002", "轨道交通用地"), ("1003", "公路用地"), ("1004", "城镇村道路用地"), ("1005", "交通服务场站用地"), ("1006", "农村道路"), ("1007", "机场用地"), ("1008", "港口码头用地"), ("1009", "管道运输用地")]),
    "11": ("水域及水利设施用地", [("1101", "河流水面"), ("1102", "湖泊水面"), ("1103", "水库水面"), ("1104", "坑塘水面"), ("1107", "沟渠"), ("1109", "水工建筑用地"), ("1110", "冰川及永久积雪")]),
    "12": ("其他土地", [("1201", "空闲地"), ("1202", "设施农用地"), ("1203", "田坎"), ("1204", "盐碱地"), ("1205", "沙地"), ("1206", "裸土地"), ("1207", "裸岩石砾地")]),
}


PLANNING_TREE = {
    "01": ("耕地", [("0101", "水田"), ("0102", "水浇地"), ("0103", "旱地")]),
    "02": ("园地", [("0201", "果园"), ("0202", "茶园"), ("0203", "橡胶园地"), ("0204", "油料园地"), ("0205", "其他园地")]),
    "03": ("林地", [("0301", "乔木林地"), ("0302", "竹林地"), ("0303", "灌木林地"), ("0304", "其他林地")]),
    "04": ("草地", [("0401", "天然牧草地"), ("0402", "人工牧草地"), ("0403", "其他草地")]),
    "05": ("湿地", [("0501", "森林沼泽"), ("0502", "灌丛沼泽"), ("0503", "沼泽草地"), ("0504", "其他沼泽地"), ("0505", "沿海滩涂"), ("0506", "内陆滩涂"), ("0507", "红树林地")]),
    "06": ("农业设施建设用地", [("0601", "农村道路", [("060101", "村道用地"), ("060102", "田间道")]), ("0602", "设施农用地", [("060201", "种植设施建设用地"), ("060202", "畜禽养殖设施建设用地"), ("060203", "水产养殖设施建设用地")])]),
    "07": ("居住用地", [("0701", "城镇住宅用地", [("070101", "一类城镇住宅用地"), ("070102", "二类城镇住宅用地"), ("070103", "三类城镇住宅用地")]), ("0702", "城镇社区服务设施用地"), ("0703", "农村宅基地", [("070301", "一类农村宅基地"), ("070302", "二类农村宅基地")]), ("0704", "农村社区服务设施用地")]),
    "08": ("公共管理与公共服务用地", [("0801", "机关团体用地"), ("0802", "科研用地"), ("0803", "文化用地", [("080301", "图书与展览用地"), ("080302", "文化活动用地")]), ("0804", "教育用地", [("080401", "高等教育用地"), ("080402", "中等职业教育用地"), ("080403", "中小学用地"), ("080404", "幼儿园用地"), ("080405", "其他教育用地")]), ("0805", "体育用地", [("080501", "体育场馆用地"), ("080502", "体育训练用地")]), ("0806", "医疗卫生用地", [("080601", "医院用地"), ("080602", "基层医疗卫生设施用地"), ("080603", "公共卫生用地")]), ("0807", "社会福利用地", [("080701", "老年人社会福利用地"), ("080702", "儿童社会福利用地"), ("080703", "残疾人社会福利用地"), ("080704", "其他社会福利用地")])]),
    "09": ("商业服务业用地", [("0901", "商业用地", [("090101", "零售商业用地"), ("090102", "批发市场用地"), ("090103", "餐饮用地"), ("090104", "旅馆用地"), ("090105", "公用设施营业网点用地")]), ("0902", "商务金融用地"), ("0903", "娱乐用地"), ("0904", "其他商业服务业用地")]),
    "10": ("工矿用地", [("1001", "工业用地", [("100101", "一类工业用地"), ("100102", "二类工业用地"), ("100103", "三类工业用地")]), ("1002", "采矿用地"), ("1003", "盐田")]),
    "11": ("仓储用地", [("1101", "物流仓储用地", [("110101", "一类物流仓储用地"), ("110102", "二类物流仓储用地"), ("110103", "三类物流仓储用地")]), ("1102", "储备库用地")]),
    "12": ("交通运输用地", [("1201", "铁路用地"), ("1202", "公路用地"), ("1203", "机场用地"), ("1204", "港口码头用地"), ("1205", "管道运输用地"), ("1206", "城市轨道交通用地"), ("1207", "城镇村道路用地"), ("1208", "交通场站用地", [("120801", "对外交通场站用地"), ("120802", "公共交通场站用地"), ("120803", "社会停车场用地")]), ("1209", "其他交通设施用地")]),
    "13": ("公用设施用地", [("1301", "供水用地"), ("1302", "排水用地"), ("1303", "供电用地"), ("1304", "供燃气用地"), ("1305", "供热用地"), ("1306", "通信用地"), ("1307", "邮政用地"), ("1308", "广播电视设施用地"), ("1309", "环卫用地"), ("1310", "消防用地"), ("1311", "水工设施用地"), ("1312", "其他公用设施用地")]),
    "14": ("绿地与开敞空间用地", [("1401", "公园绿地"), ("1402", "防护绿地"), ("1403", "广场用地")]),
    "15": ("特殊用地", [("1501", "军事设施用地"), ("1502", "使领馆用地"), ("1503", "宗教用地"), ("1504", "文物古迹用地"), ("1505", "监教场所用地"), ("1506", "殡葬用地"), ("1507", "其他特殊用地")]),
    "16": ("留白用地", []),
    "17": ("陆地水域", [("1701", "河流水面"), ("1702", "湖泊水面"), ("1703", "水库水面"), ("1704", "坑塘水面"), ("1705", "沟渠"), ("1706", "冰川及常年积雪")]),
    "18": ("渔业用海", [("1801", "渔业基础设施用海"), ("1802", "增养殖用海"), ("1803", "捕捞海域"), ("1804", "农林牧业用岛")]),
    "19": ("工矿通信用海", [("1901", "工业用海"), ("1902", "盐田用海"), ("1903", "固体矿产用海"), ("1904", "油气用海"), ("1905", "可再生能源用海"), ("1906", "海底电缆管道用海")]),
    "20": ("交通运输用海", [("2001", "港口用海"), ("2002", "航运用海"), ("2003", "路桥隧道用海"), ("2004", "机场用海"), ("2005", "其他用海")]),
    "21": ("游憩用海", [("2101", "风景旅游用海"), ("2102", "文体休闲娱乐用海")]),
    "22": ("特殊用海", [("2201", "军事用海"), ("2202", "科研教育用海"), ("2203", "海洋保护修复及海岸防护工程用海"), ("2204", "排污倾倒用海"), ("2205", "水下文物保护用海"), ("2206", "其他特殊用海")]),
    "23": ("其他土地", [("2301", "空闲地"), ("2302", "后备耕地"), ("2303", "田坎"), ("2304", "盐碱地"), ("2305", "沙地"), ("2306", "裸土地"), ("2307", "裸岩石砾地")]),
    "24": ("其他海域", []),
}


MAPPINGS = [
    ("S00", "P05"),
    ("S00-0303", "P05-0507"),
    ("S00-0304", "P05-0501"),
    ("S00-0306", "P05-0502"),
    ("S00-0402", "P05-0503"),
    ("S00-0603", "P10-1003"),
    ("S00-1105", "P05-0505"),
    ("S00-1106", "P05-0506"),
    ("S01", "P01"),
    ("S01-0101", "P01-0101"),
    ("S01-0102", "P01-0102"),
    ("S01-0103", "P01-0103"),
    ("S02", "P02"),
    ("S02-0201", "P02-0201"),
    ("S02-0202", "P02-0202"),
    ("S02-0204", "P02-0205"),
    ("S03", "P03"),
    ("S03-0301", "P03-0301"),
    ("S03-0302", "P03-0302"),
    ("S03-0305", "P03-0303"),
    ("S03-0307", "P03-0304"),
    ("S04", "P04"),
    ("S04-0401", "P04-0401"),
    ("S04-0403", "P04-0402"),
    ("S04-0404", "P04-0403"),
    ("S05", "P09"),
    ("S05-0508", "P11-1101"),
    ("S06", "P10"),
    ("S06-0601", "P10-1001"),
    ("S06-0602", "P10-1002"),
    ("S07-0701", "P07-0701"),
    ("S07-0702", "P07-0703"),
    ("S08", "P08"),
    ("S08-0809", "P13"),
    ("S09", "P15"),
    ("S10", "P12"),
    ("S10-1001", "P12-1201"),
    ("S10-1003", "P12-1202"),
    ("S10-1004", "P12-1207"),
    ("S10-1006", "P06-0601"),
    ("S10-1007", "P12-1203"),
    ("S10-1008", "P12-1204"),
    ("S10-1009", "P12-1205"),
    ("S11-1101", "P17-1701"),
    ("S11-1102", "P17-1702"),
    ("S11-1103", "P17-1703"),
    ("S11-1104", "P17-1704"),
    ("S11-1107", "P17-1705"),
    ("S12", "P23"),
    ("S12-1201", "P23-2301"),
    ("S12-1202", "P06-0602"),
    ("S12-1203", "P23-2303"),
    ("S12-1204", "P23-2304"),
    ("S12-1205", "P23-2305"),
    ("S12-1206", "P23-2306"),
    ("S12-1207", "P23-2307"),
]


def make_node(node_id, code, name, node_type, system, level, level_name, parent_id):
    return {
        "id": node_id,
        "label": f"{code} {name}" if code else name,
        "type": node_type,
        "system": system,
        "level": level,
        "code": code,
        "name": name,
        "levelName": level_name,
        "parentId": parent_id,
    }


def contains_edge(source, target):
    return {
        "source": source,
        "target": target,
        "label": "包含",
        "type": "contains",
        "lineType": "solid",
    }


def mapping_edge(source, target):
    return {
        "source": source,
        "target": target,
        "label": "对应",
        "type": "mapping",
        "lineType": "dashed",
    }


def build_graph():
    nodes = [
        make_node("root", "", "用地用海分类知识图谱", "root", "", None, "中心主题", None),
        make_node("survey", "", "国土调查工作分类", "system", "survey", None, "分类体系", "root"),
        make_node("planning", "", "国土空间调查、规划、用途管制用地用海分类", "system", "planning", None, "分类体系", "root"),
    ]
    edges = [contains_edge("root", "survey"), contains_edge("root", "planning")]

    for code, (name, children) in SURVEY_TREE.items():
        first_id = f"S{code}"
        nodes.append(make_node(first_id, code, name, "survey-category", "survey", 1, "一级类", "survey"))
        edges.append(contains_edge("survey", first_id))
        for child_code, child_name in children:
            child_id = f"{first_id}-{child_code}"
            nodes.append(make_node(child_id, child_code, child_name, "survey-detail", "survey", 2, "二级类", first_id))
            edges.append(contains_edge(first_id, child_id))

    for code, (name, children) in PLANNING_TREE.items():
        first_id = f"P{code}"
        nodes.append(make_node(first_id, code, name, "planning-category", "planning", 1, "一级类", "planning"))
        edges.append(contains_edge("planning", first_id))
        for child in children:
            child_code, child_name = child[0], child[1]
            child_id = f"{first_id}-{child_code}"
            nodes.append(make_node(child_id, child_code, child_name, "planning-detail", "planning", 2, "二级类", first_id))
            edges.append(contains_edge(first_id, child_id))
            if len(child) > 2:
                for third_code, third_name in child[2]:
                    third_id = f"{child_id}-{third_code}"
                    nodes.append(make_node(third_id, third_code, third_name, "planning-detail", "planning", 3, "三级类", child_id))
                    edges.append(contains_edge(child_id, third_id))

    for source, target in MAPPINGS:
        edges.append(mapping_edge(source, target))

    return {
        "title": "用地用海分类知识图谱",
        "description": "根据《数据.pdf》附录I表I重新整理的干净知识图谱数据。对应关系仅保留同名分类虚线关系。",
        "source": str(PDF_SOURCE),
        "notes": [
            "PDF第6页与第7页右侧内容重复，生成数据时按一份处理。",
        ],
        "nodes": nodes,
        "edges": edges,
    }


def validate(data):
    node_ids = [node["id"] for node in data["nodes"]]
    node_id_set = set(node_ids)
    if len(node_ids) != len(node_id_set):
        raise ValueError("节点 ID 不唯一")
    if any(node_id.startswith("S-NONE") for node_id in node_ids):
        raise ValueError("不允许生成 S-NONE 节点")

    node_map = {node["id"]: node for node in data["nodes"]}
    contains_parent = {}
    for edge in data["edges"]:
        if edge["source"] not in node_id_set or edge["target"] not in node_id_set:
            raise ValueError(f"边端点不存在: {edge}")
        if edge["type"] == "contains":
            contains_parent[edge["target"]] = edge["source"]
        if edge["type"] == "mapping":
            source_name = node_map[edge["source"]]["name"]
            target_name = node_map[edge["target"]]["name"]
            if source_name != target_name:
                raise ValueError(f"非同名 mapping: {edge['source']} {source_name} -> {edge['target']} {target_name}")

    for node in data["nodes"]:
        if node["id"] == "root":
            continue
        if node["parentId"] != contains_parent.get(node["id"]):
            raise ValueError(f"parentId 与 contains 不一致: {node['id']}")
        if node["system"] == "survey" and node["levelName"] == "三级类":
            raise ValueError(f"survey 不应包含三级类: {node['id']}")

    forbidden_edges = {
        ("S04-0404", "P23-2302"),
        ("S10-1002", "P12-1206"),
        ("S11-1110", "P17-1706"),
        ("S00-0304", "P05"),
    }
    actual_edges = {(edge["source"], edge["target"]) for edge in data["edges"] if edge["type"] == "mapping"}
    blocked = forbidden_edges & actual_edges
    if blocked:
        raise ValueError(f"发现禁止的 mapping: {sorted(blocked)}")


def main():
    if not PDF_SOURCE.exists():
        raise FileNotFoundError(f"PDF 源文件不存在: {PDF_SOURCE}")
    data = build_graph()
    validate(data)
    TARGET.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    mapping_count = sum(1 for edge in data["edges"] if edge["type"] == "mapping")
    contains_count = sum(1 for edge in data["edges"] if edge["type"] == "contains")
    print(f"generated {TARGET}")
    print(f"nodes={len(data['nodes'])} contains={contains_count} mappings={mapping_count}")


if __name__ == "__main__":
    main()
