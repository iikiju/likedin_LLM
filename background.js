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

  if (request.action === 'saveFeedback') {
    const fs = require('fs');
    const path = require('path');
    
    // feedbacks 디렉토리 경로
    const feedbacksDir = path.join(__dirname, 'feedbacks');
    
    // feedbacks 디렉토리가 없으면 생성
    if (!fs.existsSync(feedbacksDir)) {
      fs.mkdirSync(feedbacksDir);
    }
    
    // 피드백 파일 경로
    const feedbackFile = path.join(feedbacksDir, 'feedbacks.txt');
    
    try {
      // 피드백을 파일에 추가
      fs.appendFileSync(feedbackFile, request.feedback + '\n');
      sendResponse({ success: true });
    } catch (error) {
      console.error('피드백 저장 오류:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  if (request.action === 'saveApiKey') {
    chrome.storage.local.set({ 'openaiApiKey': request.apiKey }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === 'generateCompanyInfo') {
    generateCompanyInfo(request.companyName, request.existingInfo)
      .then(response => sendResponse(response))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // 비동기 응답을 위해 true 반환
  }

  return true;
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

  try {
    // OpenAI API 키 가져오기
    const { openaiApiKey } = await chrome.storage.local.get('openaiApiKey');
    if (!openaiApiKey) {
      throw new Error('OpenAI API 키가 설정되지 않았습니다.');
    }

    // API 키 유효성 검사
    const cleanApiKey = openaiApiKey.trim();
    if (!cleanApiKey.match(/^sk-[A-Za-z0-9-_]{32,}$/)) {
      throw new Error('유효하지 않은 API 키 형식입니다.');
    }

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
    
    // 프롬프트 생성
    const prompt = await generatePrompt(companyInfo, jobContent, promptProfile, customProfileData);
    
    console.log('OpenAI API 호출 시작...');
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cleanApiKey}`
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
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`API 오류 (${response.status}): ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const resultText = data.choices[0].message.content || '';
    
    if (!resultText) {
      throw new Error('API 응답이 비어있습니다.');
    }

    // LLM 출력 파싱
    const parsedResult = parseLLMResponse(resultText);
    console.log('파싱된 결과:', parsedResult);

    // 각 섹션의 별점이 0인 경우, 전체 별점을 기반으로 추정
    if (parsedResult.rating > 0) {
      if (parsedResult.salaryRating === 0) parsedResult.salaryRating = parsedResult.rating;
      if (parsedResult.benefitsRating === 0) parsedResult.benefitsRating = parsedResult.rating;
      if (parsedResult.jobFitRating === 0) parsedResult.jobFitRating = parsedResult.rating;
      if (parsedResult.cultureRating === 0) parsedResult.cultureRating = parsedResult.rating;
    }

    return {
      name: companyInfo.name,
      salary: parsedResult.salary,
      benefits: parsedResult.benefits,
      jobFit: parsedResult.jobFit,
      culture: parsedResult.culture,
      summary: parsedResult.summary,
      rating: parsedResult.rating,
      salaryRating: parsedResult.salaryRating,
      benefitsRating: parsedResult.benefitsRating,
      jobFitRating: parsedResult.jobFitRating,
      cultureRating: parsedResult.cultureRating
    };

  } catch (error) {
    console.error('API 호출 오류:', error);
    throw new Error(`분석 중 오류가 발생했습니다: ${error.message}`);
  }
}

// 프롬프트 생성 함수 분리
async function generatePrompt(companyInfo, jobContent, promptProfile, customProfileData) {
  try {
    let promptData;
    
    if (promptProfile === 'CUSTOM' && customProfileData) {
      // 커스텀 프로필로 프롬프트 생성
      const workTypeText = {
        'full': '풀타임',
        'part': '파트타임',
        'freelance': '프리랜서'
      }[customProfileData.workType] || '풀타임';
      
      const salaryInKRW = parseInt(customProfileData.salary) * 10000;
      
      promptData = {
        prompt: `**please remember that never the hallucination about the analysis result. you must analyze the company information and my information.
    ${customProfileData.toggleStates.name ? `I'm ${customProfileData.name},` : 'I am'}
    ${customProfileData.toggleStates.age ? `${customProfileData.age} years old,` : ''}
    ${customProfileData.toggleStates.location ? `living in ${customProfileData.location}, South Korea.` : ''}
    ${customProfileData.toggleStates.field ? `I want to work in ${customProfileData.field}` : 'I am looking for a job'}
    ${customProfileData.toggleStates.workType ? `as a ${workTypeText} position.` : '.'}
    ${customProfileData.toggleStates.major ? `I majored in ${customProfileData.major}.` : ''}
    ${customProfileData.toggleStates.skills ? `I have skills in ${customProfileData.skills}.` : ''}
    ${customProfileData.toggleStates.salary ? `I am aiming for a salary of ${salaryInKRW} KRW per year.` : ''}
    I am looking for a company that values innovation and creativity, and I want to work in a collaborative environment.
    I am also interested in companies that offer opportunities for professional development and career growth.
    I am looking for a company that values work-life balance and offers a positive work environment.
  The information about the company recommended to me is as follows.
  COMPANY_NAME to COMPANY_POSITION position.
  JOB_CONTENT
  Compare my basic information and the company information mentioned above to analyze whether the company is a good fit for me and provide a detailed analysis of the following aspects.
=============================================================================================================================================
[Salary and Compensation]
  - [Your analysis here]
  Rating: X/5 (where X is a number between 1 and 5)

[Benefits]
  - [Your analysis here]
  Rating: X/5 (where X is a number between 1 and 5)

[Job Fit]
  - [Your analysis here]
  Rating: X/5 (where X is a number between 1 and 5)

[Company Culture]
  - [Your analysis here]
  Rating: X/5 (where X is a number between 1 and 5)

[Summary]
  - [Your analysis here]
  Rating: X/5 (where X is a number between 1 and 5)
  - start sentence with "In summary, This company rating is "insert number" out of 5. When comparing companies based on ${customProfileData.toggleStates.name ? customProfileData.name : 'my profile'}

[Ratings Summary]
Please provide a summary of all ratings:
Salary and Compensation: X/5
Benefits: X/5
Job Fit: X/5
Company Culture: X/5
Overall: X/5

=============================================================================================================================================
CRITICAL INSTRUCTIONS:
1. Each section MUST end with "Rating: X/5" where X is a number between 1 and 5
2. The rating must be on a new line after the analysis
3. The rating MUST be a whole number (1, 2, 3, 4, or 5)
4. Do not skip any ratings
5. Each section must have both analysis and rating
6. The rating should reflect your analysis of that specific aspect
7. Provide a summary of all ratings in the [Ratings Summary] section`
      };
    } else {
      // 기존 프로필 사용
      const promptFile = promptProfile === 'JS' ? 'JS_prompt.json' : 'SM_prompt.json';
      const response = await fetch(chrome.runtime.getURL(promptFile));
      promptData = await response.json();
    }

    return promptData.prompt
      .replace('COMPANY_NAME', companyInfo.name)
      .replace('COMPANY_POSITION', companyInfo.jobDetails || '')
      .replace('JOB_CONTENT', jobContent);

  } catch (error) {
    console.error('프롬프트 생성 오류:', error);
    throw new Error('프롬프트 생성 중 오류가 발생했습니다.');
  }
}

// LLM 출력 파싱
function parseLLMResponse(text) {
  console.log('Parsing LLM response:', text);
  
  // 섹션별 정보 추출 (대괄호 형식으로 변경)
  const salaryMatch = text.match(/\[Salary and Compensation\]([\s\S]*?)(?=\[|$)/);
  const benefitsMatch = text.match(/\[Benefits\]([\s\S]*?)(?=\[|$)/);
  const jobFitMatch = text.match(/\[Job Fit\]([\s\S]*?)(?=\[|$)/);
  const cultureMatch = text.match(/\[Company Culture\]([\s\S]*?)(?=\[|$)/);
  const summaryMatch = text.match(/\[Summary\]([\s\S]*?)(?=\[|$)/);

  // 별점 추출 함수
  function extractRating(text) {
    if (!text) return 0;
    
    // 긍정적/부정적 키워드 기반 점수 계산
    const positiveKeywords = ['excellent', 'outstanding', 'great', 'good', 'strong', 'competitive', 'attractive', 'generous', 'appealing', 'valuable', 'comprehensive', 'extensive', 'significant', 'substantial', 'impressive', 'high-density', 'prides itself', 'aligns well', 'resonates with'];
    const negativeKeywords = ['poor', 'low', 'limited', 'basic', 'minimal', 'weak', 'inadequate', 'insufficient', 'restricted', 'modest', 'may not directly align', 'not directly align'];
    
    const textLower = text.toLowerCase();
    let score = 3; // 기본 점수
    
    // 긍정적 키워드 확인
    positiveKeywords.forEach(keyword => {
      if (textLower.includes(keyword)) score += 0.5;
    });
    
    // 부정적 키워드 확인
    negativeKeywords.forEach(keyword => {
      if (textLower.includes(keyword)) score -= 0.5;
    });
    
    // 점수 범위 조정 (0-5)
    return Math.min(Math.max(score, 0), 5);
  }

  // 각 섹션의 별점 추출
  const salaryRating = extractRating(salaryMatch ? salaryMatch[1] : '');
  const benefitsRating = extractRating(benefitsMatch ? benefitsMatch[1] : '');
  const jobFitRating = extractRating(jobFitMatch ? jobFitMatch[1] : '');
  const cultureRating = extractRating(cultureMatch ? cultureMatch[1] : '');
  
  // Summary에서 전체 평점 추출 시도
  let overallRating = 0;
  if (summaryMatch) {
    const summaryText = summaryMatch[1];
    const ratingMatch = summaryText.match(/rating is (\d+(?:\.\d+)?) out of 5/i);
    if (ratingMatch) {
      overallRating = parseFloat(ratingMatch[1]);
    }
  }
  
  // 전체 평점이 없으면 섹션 평균으로 계산
  if (overallRating === 0) {
    overallRating = (salaryRating + benefitsRating + jobFitRating + cultureRating) / 4;
  }

  // Remove numerical ratings from the text
  const cleanText = (text) => {
    return text.replace(/Rating: \d+\/5/g, '').trim();
  };

  return {
    name: text.match(/Company:\s*([^\n]+)/)?.[1] || 'Unknown Company',
    salary: cleanText(salaryMatch ? salaryMatch[1] : ''),
    benefits: cleanText(benefitsMatch ? benefitsMatch[1] : ''),
    jobFit: cleanText(jobFitMatch ? jobFitMatch[1] : ''),
    culture: cleanText(cultureMatch ? cultureMatch[1] : ''),
    summary: cleanText(summaryMatch ? summaryMatch[1] : ''),
    salaryRating,
    benefitsRating,
    jobFitRating,
    cultureRating,
    rating: overallRating
  };
}

// 회사 정보 생성
async function generateCompanyInfo(companyName, existingInfo) {
  try {
    console.log('회사 정보 생성 시작:', { companyName, existingInfo });
    
    // OpenAI API 키 확인
    const apiKey = await new Promise((resolve) => {
      chrome.storage.local.get(['openaiApiKey'], (result) => {
        console.log('background.js에서 API 키 확인:', result.openaiApiKey ? '있음' : '없음');
        resolve(result.openaiApiKey);
      });
    });

    if (!apiKey) {
      console.error('OpenAI API 키가 설정되지 않았습니다.');
      return { success: false, error: 'OpenAI API 키가 설정되지 않았습니다.' };
    }

    const prompt = `
회사명 "${companyName}"에 대한 정보를 생성해주세요.
다음 형식의 JSON으로 응답해주세요:
{
  "name": "회사명",
  "industry": "산업 분야",
  "description": "회사 설명",
  "size": "회사 규모",
  "founded": "설립 연도",
  "headquarters": "본사 위치",
  "specialties": ["전문 분야1", "전문 분야2"],
  "website": "웹사이트 URL"
}

기존 정보:
${JSON.stringify(existingInfo, null, 2)}
`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that generates company information in JSON format.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    const data = await response.json();
    console.log('OpenAI 응답:', data);

    if (!response.ok) {
      throw new Error(data.error?.message || 'OpenAI API 요청 실패');
    }

    const generatedText = data.choices[0].message.content.trim();
    console.log('생성된 텍스트:', generatedText);

    // JSON 형식 추출
    const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('JSON 형식을 찾을 수 없습니다.');
    }

    const companyInfo = JSON.parse(jsonMatch[0]);
    console.log('파싱된 회사 정보:', companyInfo);

    return {
      success: true,
      data: {
        ...existingInfo,
        ...companyInfo
      }
    };
  } catch (error) {
    console.error('회사 정보 생성 오류:', error);
    return { success: false, error: error.message };
  }
}
