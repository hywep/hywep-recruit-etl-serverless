export const EXCLUDE_KEYS = ["number", "targetMajors", "contactDepartment", "progressStatus", "additionalRecruitmentInfo"];
export const INVALID_VALUES = ["", "-"];

export const KEY_MAPPING: Record<string, string> = {
    "번호": "number",
    "실습기관분류": "organizationType",
    "실습기관명": "organizationName",
    "부서": "department",
    "실습기관 진행상태": "status",
    "신규모집": "newRecruitment",
    "홈페이지": "homepage",
    "소재지": "location",
    "모집마감일": "applicationDeadline",
    "마감시간": "deadlineTime",
    "실습기간": "internshipPeriod",
    "기관지원금": "organizationSupportAmount",
    "유형": "type",
    "모집전공": "majors",
    "모집인원": "recruitCount",
    "지원인원": "applicantCount",
    "실습신청": "internshipApplication",
    "id": "id",
    "현장실습명": "internshipName",
    "직원수": "employeeCount",
    "기관규모": "organizationSize",
    "상장여부": "isListed",
    "실습기관소개": "organizationDescription",
    "선발대상": "targetMajors",
    "소개자료": "introductionMaterials",
    "현장실습 지원센터코멘트": "comments",
    "선발정보": "selectionInfo",
    "자격사항": "qualifications",
    "실습내용": "internshipDetails",
    "면접정보": "interviewInfo",
    "근무시간": "workingHours",
    "근무요일": "workingDays",
    "지도교수": "advisor",
    "모집공고 추가자료": "additionalRecruitmentInfo",
    "진행상태": "progressStatus",
};

export const colleges = {
    공과대학: [
        "반도체공학과",
        "건축학부",
        "건축공학부",
        "건설환경공학과",
        "도시공학과",
        "자원환경공학과",
        "융합전자공학부",
        "전기ㆍ생체공학부",
        "신소재공학부",
        "화학공학과",
        "생명공학과",
        "유기나노공학과",
        "에너지공학과",
        "기계공학부",
        "원자력공학과",
        "산업공학과",
    ],
    소프트웨어대학: [
        "데이터사이언스학부",
        "컴퓨터소프트웨어학부",
        "정보시스템학과",
        "미래자동차공학과",
    ],
    // 의과대학: [
    //     "의예과",
    //     "의학과",
    // ],
    간호대학: [
        "간호학과",
    ],
    인문과학대학: [
        "국어국문학과",
        "중어중문학과",
        "영어영문학과",
        "독어독문학과",
        "사학과",
        "철학과",
        "미래인문학융합학부",
        "대중문화·시나리오학과",
    ],
    사회과학대학: [
        "정치외교학과",
        "사회학과",
        "미디어커뮤니케이션학과",
        "관광학부",
    ],
    생활과학대학: [
        "의류학과",
        "식품영양학과",
        "실내건축디자인학과",
        "기능성식품학과",
    ],
    자연과학대학: ["수학과", "물리학과", "화학과", "생명과학과"],
    정책과학대학: ["정책학과", "행정학과"],
    경제금융대학: ["경제금융학부"],
    경영대학: ["경영학부", "파이낸스경영학과"],
    사범대학: [
        "교육학과",
        "교육공학과",
        "국어교육과",
        "영어교육과",
        "수학교육과",
        "응용미술교육과",
    ],
    국제학부: ["국제학부"],
    음악대학: [
        "성악과",
        "작곡과",
        "피아노과",
        "관현악과",
        "국악과",
    ],
    예술체육대학: [
        "스포츠산업과학부 스포츠사이언스전공",
        "스포츠산업과학부 스포츠매니지먼트전공",
        "연극영화학과",
        "무용학과",
    ],
};

export const relatedColleges = {
    이공계열: ["공과대학", "소프트웨어대학", "자연과학대학"],
    공학계열: ["공과대학", "소프트웨어대학"],
    상경계열: ["경제금융대학", "경영대학", "사회과학대학"],
    인문계열: ["인문과학대학", "사회과학대학", "사범대학"],
    인문사회계열: ["인문과학대학", "사회과학대학", "정책과학대학", "사범대학"],
    사회계열: ["사회과학대학", "정책과학대학"],
    어문계열: ["인문과학대학"],
    SW: ["소프트웨어대학"],
};

export const special = {
    전산: [
        "컴퓨터소프트웨어학부",
        "데이터사이언스학부",
        "정보시스템학과",
        "융합전자공학부",
        "미래자동차공학과",
    ],
    광고홍보: [
        "미디어커뮤니케이션학과",
        "대중문화·시나리오학과",
        "경영학부",
        "사회학과",
    ],
    의료바이오: [
        "의학과",
        "간호학과",
        "생명공학과",
        "화학공학과",
    ],
    디자인: [
        "응용미술교육과",
        "실내건축디자인학과",
        "대중문화·시나리오학과",
    ],
    컴퓨터공학: [
        "컴퓨터소프트웨어학부",
    ],
    예체능: [
        "응용미술교육과",
        "실내건축디자인학과",
        "대중문화·시나리오학과",
        "시각디자인학과",
        "스포츠산업과학부 스포츠사이언스전공",
        "스포츠산업과학부 스포츠매니지먼트전공",
        "연극영화학과",
        "무용학과",
    ],
    전기전자공학: [
        "전기ㆍ생체공학부",
    ],
    재료공학: [
        "신소재공학부",
    ],
    생물학: [
        "생명공학과",
    ],
    창업: [
        "창업 경험",
    ]
};

