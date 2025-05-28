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

// LLM API 호출 (OpenAI API 사용)
async function callLLMApi(companyInfo, companyData) {
  const apiUrl = 'https://api.openai.com/v1/chat/completions';
  const jobContent = companyInfo.description || companyInfo.description || JSON.stringify(companyInfo);

  // 현재 선택된 프롬프트 프로필 가져오기
  const { promptProfile = 'JS' } = await chrome.storage.local.get('promptProfile');
  console.log(`Using prompt profile: ${promptProfile}`);
  
  // 커스텀 프로필인 경우 사용자 입력 데이터 가져오기
  let customProfileData = null;
  if (promptProfile === 'CUSTOM') {
    const { customProfile } = await chrome.storage.local.get('customProfile');
    customProfileData = customProfile;
    console.log('Using custom profile data:', customProfileData);
  }
  
  // JSON 파일에서 프롬프트 로드 또는 커스텀 프롬프트 생성
  let promptData;
  try {
    if (promptProfile === 'CUSTOM' && customProfileData) {
      // 커스텀 프로필로 프롬프트 생성
      const workTypeText = {
        'full': '풀타임',
        'part': '파트타임',
        'freelance': '프리랜서'
      }[customProfileData.workType] || '풀타임';
      
      const salaryInKRW = parseInt(customProfileData.salary) * 10000; // 만원 단위를 원 단위로 변환
      
      promptData = {
        prompt: `**please remember that never the hallucination about the analysis result. you must analyze the company information and my information.
    ${customProfileData.toggleStates.name ? `I'm ${customProfileData.name},` : 'I am'}
    ${customProfileData.toggleStates.age ? `${customProfileData.age} years old,` : ''}
    ${customProfileData.toggleStates.location ? `living in ${customProfileData.location}, South Korea.` : ''}
    ${customProfileData.toggleStates.field ? `I want to work in ${customProfileData.field}` : 'I am looking for a job'}
    ${customProfileData.toggleStates.workType ? `as a ${workTypeText} position.` : '.'}
    ${customProfileData.toggleStates.major ? `I majored in ${customProfileData.major}.` : ''}
    ${customProfileData.toggleStates.skills ? `I have skills in ${customProfileData.skills}.` : ''}
    ${customProfileData.toggleStates.salary ? `I am aiming for a salary of ${parseInt(customProfileData.salary) * 10000} KRW per year.` : ''}
    I am looking for a company that values innovation and creativity, and I want to work in a collaborative environment.
    I am also interested in companies that offer opportunities for professional development and career growth.
    I am looking for a company that values work-life balance and offers a positive work environment.

  The information about the company recommended to me is as follows.
  COMPANY_NAME to COMPANY_POSITION position.
  JOB_CONTENT
  Compare my basic information and the company information mentioned above to analyze whether the company is a good fit for me and provide a detailed analysis of the following aspects.
=============================================================================================================================================
[Salary and Compensation]
  - 
[Benefits]
  -
[Job Fit]
  -
[Company Culture]
  - 
[Summary]
  - start sentence with "In summary, This company rating is "insert number" out of 5. When comparing companies based on ${customProfileData.toggleStates.name ? customProfileData.name : 'my profile'}
=============================================================================================================================================
Please provide your analysis in English following the exact format above.`
      };
      console.log('Created custom prompt template');
    } else {
      // 기존 프로필 사용
      const promptFile = promptProfile === 'JS' ? 'JS_prompt.json' : 'SM_prompt.json';
      const response = await fetch(chrome.runtime.getURL(promptFile));
      promptData = await response.json();
      console.log(`Loaded prompt from ${promptFile}`);
    }
  } catch (error) {
    console.error('Error loading prompt:', error);
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
    console.log('OpenAI API 호출 시작...');
    console.log('분석할 내용:', jobContent);
    console.log('사용 중인 페르소나:', promptProfile);
    
    const fetchWithTimeout = (url, options, timeout = 600000) => {
      return Promise.race([
        fetch(url, options),
        new Promise((_, reject) => setTimeout(() => reject(new Error('요청 타임아웃')), timeout))
      ]);
    };

    // OpenAI API 키 가져오기
    const { openaiApiKey } = await chrome.storage.local.get('openaiApiKey');
    if (!openaiApiKey) {
      throw new Error('OpenAI API 키가 설정되지 않았습니다.');
    }

    const response = await fetchWithTimeout(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that analyzes company information and provides detailed insights.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      }),
    }, 600000);

    if (!response.ok) {
      throw new Error('OpenAI API 호출 실패');
    }

    const data = await response.json();
    let resultText = data.choices[0].message.content || '';

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
        const ratingMatch = summaryMatch[1].match(/rating is (\d+(?:\.\d+)?) out of 5/i);
        if (ratingMatch) {
          const rating = parseInt(ratingMatch[1]);
          if (!isNaN(rating) && rating >= 0 && rating <= 5) {
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
    console.error('OpenAI API 호출 오류:', error);
    throw error;
  }
}
