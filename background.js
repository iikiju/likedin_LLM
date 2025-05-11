// LLM 통합 및 회사 정보 분석 처리
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyzeCompany') {
    // content.js에서 전달받은 jobDetails 사용
    analyzeCompanyWithLLM({
      name: request.companyInfo.name,
      jobDetails: request.companyInfo.description
    })
      .then(analysisResult => {
        sendResponse({ success: true, data: analysisResult });
      })
      .catch(error => {
        console.error('회사 분석 오류:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    return true;
  }
});

// LLM을 사용하여 회사 정보 분석
async function analyzeCompanyWithLLM(companyInfo) {
  try {
    // 회사 정보 검색
    const companyData = await searchCompanyInfo(companyInfo.name, companyInfo.jobDetails);
    
    // LLM API 호출
    const analysisResult = await callLLMApi(companyInfo, companyData);
    
    return analysisResult;
  } catch (error) {
    console.error('LLM 분석 오류:', error);
    throw error;
  }
}

// 회사 정보 검색 (외부 API 연동)
async function searchCompanyInfo(companyName, jobDetails = null) {
  try {
    // 기본 데이터
    const defaultData = {
      industry: '금융 서비스',
      size: '대기업',
      averageSalary: '정보 없음',
      benefits: '정보 없음',
      locations: '서울',
      culture: '혁신적이고 자유로운 문화',
      name: companyName,
      jobDetails: jobDetails || '정보 없음'
    };
    
    return defaultData;
  } catch (error) {
    console.error('회사 정보 검색 오류:', error);
    throw error;
  }
}

// LLM API 호출 (로컬 Ollama 사용)
async function callLLMApi(companyInfo, companyData) {
  const apiUrl = 'http://localhost:11434/api/generate';

  const jobContent = companyInfo.description || companyInfo.description || JSON.stringify(companyInfo);

  const prompt = `You are a helpful assistant that analyzes job postings. Please follow these steps:

1. First, translate the following Korean job posting content to English if it contains Korean text. Keep the original Korean text in parentheses for reference.

2. Then, analyze the translated content and provide a comprehensive analysis in Korean, following this exact format:

[급여 및 보상]
여기에 급여와 보상에 대한 분석을 작성하세요.

[복지 혜택]
여기에 복지 혜택에 대한 분석을 작성하세요.

[직무 적합도]
여기에 직무 적합도와 요구사항에 대한 분석을 작성하세요.

[회사 문화]
여기에 회사 문화와 근무 환경에 대한 분석을 작성하세요.

[종합 평가]
여기에 종합적인 평가와 요약을 작성하세요.

[별점]
1-5 사이의 숫자만 입력하세요.

Here is the job posting content:

${jobContent}

Please provide your analysis in Korean following the exact format above.`;

  try {
    console.log('Ollama API 호출 시작...');
    console.log('분석할 내용:', jobContent);
    
    const fetchWithTimeout = (url, options, timeout = 600000) => {
      return Promise.race([
        fetch(url, options),
        new Promise((_, reject) => setTimeout(() => reject(new Error('요청 타임아웃')), timeout))
      ]);
    };
    const response = await fetchWithTimeout(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen3:8b',
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
          top_k: 40,
          num_ctx: 8192,
          num_thread: 4,
          repeat_penalty: 1.1
        }
      }),
    }, 600000);

    if (!response.ok) {
      throw new Error('LLM API 호출 실패');
    }

    const data = await response.json();
    let resultText = data.response || '';

    // LLM 출력 파싱
    const parseLLMResponse = (text) => {
      const sections = {
        salary: '',
        benefits: '',
        jobFit: '',
        culture: '',
        summary: '',
        rating: 3 // 기본값
      };

      // 각 섹션 추출
      const salaryMatch = text.match(/\[급여 및 보상\]([\s\S]*?)(?=\[|$)/);
      const benefitsMatch = text.match(/\[복지 혜택\]([\s\S]*?)(?=\[|$)/);
      const jobFitMatch = text.match(/\[직무 적합도\]([\s\S]*?)(?=\[|$)/);
      const cultureMatch = text.match(/\[회사 문화\]([\s\S]*?)(?=\[|$)/);
      const summaryMatch = text.match(/\[종합 평가\]([\s\S]*?)(?=\[|$)/);
      const ratingMatch = text.match(/\[별점\]([\s\S]*?)(?=\[|$)/);

      if (salaryMatch) sections.salary = salaryMatch[1].trim();
      if (benefitsMatch) sections.benefits = benefitsMatch[1].trim();
      if (jobFitMatch) sections.jobFit = jobFitMatch[1].trim();
      if (cultureMatch) sections.culture = cultureMatch[1].trim();
      if (summaryMatch) {
        let summary = summaryMatch[1].trim();
        // </think> 태그 제거
        summary = summary.replace(/<\/think>/g, '');
        // 문장 단위로 분리
        const sentences = summary.split(/[.!?]+/).filter(s => s.trim().length > 0);
        // 3문장으로 제한
        sections.summary = sentences.slice(0, 3).join('. ') + '.';
      }
      if (ratingMatch) {
        const rating = parseInt(ratingMatch[1].trim());
        if (!isNaN(rating) && rating >= 1 && rating <= 5) {
          sections.rating = rating;
        }
      }

      return sections;
    };

    const parsedResult = parseLLMResponse(resultText);
    console.log('파싱된 결과:', parsedResult);

    return {
      name: companyInfo.name,
      salary: parsedResult.salary,
      benefits: parsedResult.benefits,
      jobFit: parsedResult.jobFit,
      culture: parsedResult.culture,
      summary: parsedResult.summary,
      rating: parsedResult.rating
    };
  } catch (error) {
    console.error('LLM API 호출 오류:', error);
    throw error;
  }
}

// 모의 분석 결과 생성 (LLM 연결 실패 시 사용)
function getMockAnalysis(companyName) {
  const mockAnalyses = {
    'Google': {
      name: 'Google',
      salary: '업계 최고 수준의 연봉을 제공하며, 경력과 직급에 따라 차이가 있으나 대체로 시장 평균보다 30-40% 높은 수준입니다.',
      benefits: '건강보험, 퇴직연금 외에도 무제한 간식, 사내 체육관, 자유로운 근무환경 등 다양한 복지를 제공합니다.',
      jobFit: '기술직의 경우 높은 성장 가능성과 기술 역량 개발 기회가 많으며, 마케팅이나 디자인 직군도 글로벌 프로젝트 경험을 쌓을 수 있습니다.',
      rating: 5,
      summary: '높은 연봉과 훌륭한 복지, 기술 혁신 기회가 많은 최상위 기업입니다.'
    },
    'Microsoft': {
      name: 'Microsoft',
      salary: '업계 상위 수준의 연봉을 제공하며, 시장 평균보다 20-30% 높은 편입니다.',
      benefits: '건강보험, 퇴직연금, 유연근무제 외에도 다양한 교육 프로그램 지원이 특징적입니다.',
      jobFit: '개발자, 엔지니어 직군에 특히 적합하며 클라우드, AI 분야에서 높은 성장 가능성이 있습니다.',
      rating: 4,
      summary: '안정적인 근무 환경과 좋은 복지, 기술 발전 기회가 있는 우수한 기업입니다.'
    },
    'Naver': {
      name: 'Naver',
      salary: '국내 IT 기업 중 상위 연봉 수준으로, 경력과 직무에 따라 차이가 있으나 시장 평균 대비 높은 편입니다.',
      benefits: '건강보험, 퇴직연금, 사내 카페, 교통비 지원 등 다양한 복지 혜택을 제공합니다.',
      jobFit: '개발자, 디자이너, 콘텐츠 기획자 등 다양한 직군에 적합하며, 국내 시장에서 높은 영향력을 가진 프로젝트에 참여할 기회가 많습니다.',
      rating: 4,
      summary: '국내 최고 IT 기업으로 안정적인 성장과 좋은 근무 환경을 제공합니다.'
    },
    'Kakao': {
      name: 'Kakao',
      salary: '국내 IT 기업 중 상위권 연봉 수준으로, 시장 평균보다 높은 편입니다.',
      benefits: '건강보험, 퇴직연금, 유연근무제, 카페테리아 등 다양한 복지 혜택이 특징입니다.',
      jobFit: '개발자, 디자이너, 서비스 기획자 등 다양한 직군에 적합하며, 혁신적인 서비스 개발 경험을 쌓을 수 있습니다.',
      rating: 4,
      summary: '창의적인 기업 문화와 다양한 서비스 포트폴리오를 가진 성장하는 기업입니다.'
    }
  };
  
  // 일치하는 회사가 없으면 기본 분석 결과 생성
  if (!mockAnalyses[companyName]) {
    return {
      name: companyName,
      salary: '해당 회사의 연봉 정보는 현재 충분한 데이터가 없어 정확한 분석이 어렵습니다.',
      benefits: '회사의 복지 제도에 대한 상세 정보가 제한적입니다.',
      jobFit: '직무 적합도를 평가하기 위한 충분한 정보가 없습니다.',
      rating: 3,
      summary: '추가 정보가 필요한 회사입니다.'
    };
  }
  
  return mockAnalyses[companyName];
} 