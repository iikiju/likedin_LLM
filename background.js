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
      industry: '',
      size: '',
      averageSalary: '',
      benefits: '',
      locations: '',
      culture: '',
      name: companyName,
      jobDetails: jobDetails || ''
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

  // 현재 선택된 프롬프트 프로필 가져오기
  const { promptProfile = 'JS' } = await chrome.storage.local.get('promptProfile');
  console.log(`Using prompt profile: ${promptProfile}`);
  
  // JSON 파일에서 프롬프트 로드
  let promptData;
  try {
    const promptFile = promptProfile === 'JS' ? 'JS_prompt.json' : 'SM_prompt.json';
    const response = await fetch(chrome.runtime.getURL(promptFile));
    promptData = await response.json();
    console.log(`Loaded prompt from ${promptFile}`);
  } catch (error) {
    console.error('Error loading prompt file:', error);
    // 오류 발생 시 기본 프롬프트 사용
    promptData = { 
      prompt: promptProfile === 'JS' ? 
        "I'm JeoungSu, analyze this company..." : 
        "I'm SuMin, analyze this company..." 
    };
  }
  
  // 파일에서 불러온 프롬프트에 동적 데이터 삽입
  let prompt = promptData.prompt
    .replace('COMPANY_NAME', companyInfo.name)
    .replace('COMPANY_POSITION', companyInfo.jobDetails || '')
    .replace('JOB_CONTENT', jobContent);

  try {
    console.log('Ollama API 호출 시작...');
    console.log('분석할 내용:', jobContent);
    console.log('사용 중인 페르소나:', promptProfile);
    
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
        model: 'mistral', // mistral, phi, tinyllama, qwen3:1.7b, qwen3:8b, 
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
          top_k: 40,
          num_ctx: 8192,
          num_thread: 8,
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
        rating: '' // 기본값
      };

      // 각 섹션 추출
      const salaryMatch = text.match(/\[Salary and Compensation\]([\s\S]*?)(?=\[|$)/);
      const benefitsMatch = text.match(/\[Benefits\]([\s\S]*?)(?=\[|$)/);
      const jobFitMatch = text.match(/\[Job Fit\]([\s\S]*?)(?=\[|$)/);
      const cultureMatch = text.match(/\[Company Culture\]([\s\S]*?)(?=\[|$)/);
      const summaryMatch = text.match(/\[Summary\]([\s\S]*?)(?=\[|$)/);

      if (salaryMatch) sections.salary = salaryMatch[1].trim().replace(/<\/think>/g, '');
      if (benefitsMatch) sections.benefits = benefitsMatch[1].trim().replace(/<\/think>/g, '');
      if (jobFitMatch) sections.jobFit = jobFitMatch[1].trim().replace(/<\/think>/g, '');
      if (cultureMatch) sections.culture = cultureMatch[1].trim().replace(/<\/think>/g, '');
      if (summaryMatch) sections.summary = summaryMatch[1].trim().replace(/<\/think>/g, '');

      // Summary에서 rating 추출
      if (summaryMatch) {
        const ratingMatch = summaryMatch[1].match(/rating is (\d+) out of 5/i);
        if (ratingMatch) {
          const rating = parseInt(ratingMatch[1]);
          if (!isNaN(rating) && rating >= 1 && rating <= 5) {
            sections.rating = rating;
          }
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
