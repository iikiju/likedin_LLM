document.addEventListener('DOMContentLoaded', () => {
  console.log('팝업 로드됨');
  
  // 도구 버튼 이벤트 리스너 추가
  document.getElementById('check-ollama').addEventListener('click', checkOllamaConnection);
  document.getElementById('use-mock-data').addEventListener('click', useMockData);
  
  // 현재 탭의 URL 확인
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    const url = currentTab.url;
    
    console.log('현재 탭 URL:', url);
    
    // LinkedIn 페이지인지 확인
    if (url && url.includes('linkedin.com')) {
      // 페이지에서 회사 정보를 가져올 수 있는 상태인지 확인
      console.log('LinkedIn 페이지 확인됨, 회사 정보 요청 중...');
      
      try {
        chrome.tabs.sendMessage(
          currentTab.id, 
          { action: 'checkCompanyInfo' },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error('메시지 전송 오류:', chrome.runtime.lastError.message);
              showStatus('LinkedIn 페이지에서 회사 정보를 확인하세요. 페이지를 새로고침하거나 다른 LinkedIn 페이지를 시도해보세요.');
              return;
            }
            
            console.log('컨텐츠 스크립트 응답:', response);
            
            if (response && response.companiesInfo && response.companiesInfo.length > 0) {
              // 회사 목록 표시
              showCompanyList(response.companiesInfo, currentTab.id);
            } else {
              showStatus('LinkedIn 페이지에서 회사 정보를 찾을 수 없습니다. 회사 프로필이나 채용 공고 페이지를 방문해보세요.');
            }
          }
        );
      } catch (error) {
        console.error('메시지 전송 중 예외 발생:', error);
        showStatus('LinkedIn 페이지와의 통신 중 오류가 발생했습니다. 페이지를 새로고침하고 다시 시도해보세요.');
      }
    } else {
      showStatus('LinkedIn 페이지에서 익스텐션을 실행하세요.');
    }
  });
});

// 회사 목록 표시
function showCompanyList(companies, tabId) {
  console.log('회사 목록 표시:', companies);
  
  // company-info 요소 비우기
  const companyInfoElement = document.getElementById('company-info');
  companyInfoElement.innerHTML = '';
  companyInfoElement.classList.remove('hidden');
  
  // 에러 메시지 숨기기
  document.getElementById('error-container').classList.add('hidden');
  
  // 제목 추가
  const titleElement = document.createElement('h3');
  titleElement.textContent = '분석할 회사 선택';
  titleElement.style.marginBottom = '10px';
  companyInfoElement.appendChild(titleElement);
  
  // 회사가 없으면 메시지 표시
  if (!companies || companies.length === 0) {
    const messageElement = document.createElement('p');
    messageElement.className = 'status-message';
    messageElement.textContent = '회사 정보를 찾을 수 없습니다.';
    companyInfoElement.appendChild(messageElement);
    return;
  }
  
  // 회사 목록 생성
  const listElement = document.createElement('ul');
  listElement.className = 'company-list';
  listElement.style.listStyle = 'none';
  listElement.style.padding = '0';
  listElement.style.margin = '0';
  
  companies.forEach((company, index) => {
    const listItem = document.createElement('li');
    listItem.style.padding = '8px 0';
    listItem.style.borderBottom = '1px solid #eee';
    listItem.style.cursor = 'pointer';
    listItem.style.display = 'flex';
    listItem.style.justifyContent = 'space-between';
    listItem.style.alignItems = 'center';
    
    // 회사 정보 컨테이너
    const infoContainer = document.createElement('div');
    
    // 회사명
    const nameElement = document.createElement('div');
    nameElement.textContent = company.name;
    nameElement.style.fontWeight = 'bold';
    infoContainer.appendChild(nameElement);
    
    // 산업 정보가 있으면 표시
    if (company.industry) {
      const industryElement = document.createElement('div');
      industryElement.textContent = company.industry;
      industryElement.style.fontSize = '12px';
      industryElement.style.color = '#666';
      infoContainer.appendChild(industryElement);
    }
    
    listItem.appendChild(infoContainer);
    
    // 분석 버튼
    const analyzeButton = document.createElement('button');
    analyzeButton.textContent = '분석';
    analyzeButton.style.backgroundColor = '#0077b5';
    analyzeButton.style.color = 'white';
    analyzeButton.style.border = 'none';
    analyzeButton.style.borderRadius = '4px';
    analyzeButton.style.padding = '4px 8px';
    analyzeButton.style.fontSize = '12px';
    analyzeButton.style.cursor = 'pointer';
    
    // 모의 데이터 버튼
    const mockButton = document.createElement('button');
    mockButton.textContent = '모의';
    mockButton.style.backgroundColor = '#4caf50';
    mockButton.style.color = 'white';
    mockButton.style.border = 'none';
    mockButton.style.borderRadius = '4px';
    mockButton.style.padding = '4px 8px';
    mockButton.style.fontSize = '12px';
    mockButton.style.cursor = 'pointer';
    mockButton.style.marginRight = '5px';
    
    // 버튼 컨테이너
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.appendChild(mockButton);
    buttonContainer.appendChild(analyzeButton);
    
    // 모의 데이터 버튼 클릭 이벤트
    mockButton.addEventListener('click', () => {
      // 모의 데이터로 즉시 표시
      showLoading();
      setTimeout(() => {
        // 모의 데이터 생성
        const mockData = getMockAnalysisData(company.name);
        showAnalysisResult(mockData);
      }, 500);
    });
    
    // 분석 버튼 클릭 이벤트
    analyzeButton.addEventListener('click', () => {
      // 선택된 회사 분석 시작
      showLoading();
      
      // 컨텐츠 스크립트에 특정 회사 분석 요청
      chrome.tabs.sendMessage(
        tabId,
        { action: 'analyzeSelectedCompany', companyName: company.name },
        (response) => {
          if (response && response.success && response.companyInfo) {
            // 백그라운드 스크립트에 분석 요청
            analyzeCompany(response.companyInfo);
          } else {
            showError('회사 정보를 찾을 수 없습니다.');
          }
        }
      );
    });
    
    listItem.appendChild(buttonContainer);
    listElement.appendChild(listItem);
  });
  
  companyInfoElement.appendChild(listElement);
  
  // 분석 결과 및 로딩 숨기기
  document.getElementById('analysis-result').classList.add('hidden');
  document.getElementById('loading').classList.add('hidden');
}

// Ollama 연결 상태 확인
async function checkOllamaConnection() {
  try {
    showStatus('Ollama 연결 확인 중...');
    document.getElementById('error-container').classList.add('hidden');
    
    // 먼저 간단한 HEAD 요청으로 서버가 실행 중인지 확인
    const pingResponse = await fetch('http://localhost:11434/api/tags', {
      method: 'GET',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
      }
    }).catch(error => {
      console.error('Ping 요청 실패:', error);
      showError('Ollama 서버 연결 실패: ' + error.message);
      return null;
    });
    
    if (pingResponse && pingResponse.ok) {
      const data = await pingResponse.json();
      console.log('Ollama 서버 태그 정보:', data);
      
      // 모델 리스트 표시
      let modelList = '사용 가능한 모델: ';
      if (data && data.models && data.models.length > 0) {
        modelList += data.models.map(m => m.name).join(', ');
      } else {
        modelList += '모델 정보 없음';
      }
      
      // qwen3 모델이 있는지 확인
      const hasQwen3 = data.models && data.models.some(m => m.name === 'qwen3:8b');
      if (!hasQwen3) {
        showError('Qwen3:8b 모델이 설치되어 있지 않습니다. 다음 명령어로 설치하세요: ollama pull qwen3:8b');
        showStatus('Ollama 서버는 실행 중이지만 Qwen3:8b 모델이 필요합니다.');
        return;
      }
      
      // 서버가 응답하면 모델 테스트
      const testMessage = '이것은 Ollama API 연결 테스트입니다.';
      const requestTimeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('요청 타임아웃')), 100000)
      );
      
      const modelResponse = await Promise.race([
        fetch('http://localhost:11434/api/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'qwen3:8b',
            prompt: testMessage,
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
        }),
        requestTimeout
      ]);
      
      if (modelResponse.ok) {
        const responseData = await modelResponse.json();
        console.log('Ollama API 응답:', responseData);
        showStatus('Ollama 연결 성공! 분석 준비가 완료되었습니다.<br>' + modelList);
      } else {
        const errorText = await modelResponse.text();
        console.error('Ollama API 오류 응답:', errorText);
        showError(`Ollama API 오류 (${modelResponse.status}): ${modelResponse.statusText}`);
        showStatus('Ollama 서버에 연결할 수 있지만 응답이 올바르지 않습니다. 모델이 로드되었는지 확인하세요.');
      }
    } else if (pingResponse) {
      showError(`Ollama API 오류 (${pingResponse.status}): ${pingResponse.statusText}`);
      showStatus('Ollama 서버 연결 실패. 서버가 실행 중인지 확인하세요. 서버 재시작 방법: ollama serve');
    } else {
      showStatus('Ollama 서버 연결 실패. 서버가 실행 중인지 확인하세요.');
    }
  } catch (error) {
    console.error('Ollama 연결 오류:', error);
    showError('Ollama 연결 오류: ' + error.message);
    showStatus('Ollama 연결 실패. CORS 오류일 수 있습니다. 확장 프로그램을 재로드하고 다시 시도하세요.');
  }
}

// 모의 데이터 사용 함수
function useMockData() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    
    chrome.tabs.sendMessage(
      currentTab.id, 
      { action: 'checkCompanyInfo' },
      (response) => {
        if (chrome.runtime.lastError || !response || !response.companiesInfo || response.companiesInfo.length === 0) {
          // 회사 정보가 없으면 샘플 회사 데이터 사용
          const sampleCompanies = [
            { name: 'Google', industry: '기술' },
            { name: 'Microsoft', industry: '기술' },
            { name: 'Naver', industry: '기술' },
            { name: 'Kakao', industry: '기술' }
          ];
          
          // 바로 모의 데이터로 첫 번째 회사 분석 결과 표시
          showLoading();
          setTimeout(() => {
            const mockData = getMockAnalysisData(sampleCompanies[0].name);
            showAnalysisResult(mockData);
          }, 50000);
        } else {
          // 현재 페이지의 첫 번째 회사 모의 데이터 표시
          const company = response.companiesInfo[0];
          showLoading();
          setTimeout(() => {
            const mockData = getMockAnalysisData(company.name);
            showAnalysisResult(mockData);
          }, 50000);
        }
      }
    );
  });
}

// 에러 메시지 표시
function showError(message) {
  const errorContainer = document.getElementById('error-container');
  errorContainer.textContent = message;
  errorContainer.classList.remove('hidden');
}

// 상태 메시지 표시
function showStatus(message) {
  console.log('상태 메시지:', message);
  
  // company-info 요소 내용 설정
  const companyInfoElement = document.getElementById('company-info');
  companyInfoElement.innerHTML = `<div class="status-message">${message}</div>`;
  companyInfoElement.classList.remove('hidden');
  
  // 다른 요소 숨기기
  document.getElementById('analysis-result').classList.add('hidden');
  document.getElementById('loading').classList.add('hidden');
}

// 로딩 화면 표시
function showLoading() {
  console.log('로딩 화면 표시');
  document.getElementById('company-info').classList.add('hidden');
  document.getElementById('analysis-result').classList.add('hidden');
  document.getElementById('error-container').classList.add('hidden');
  
  const loadingElement = document.getElementById('loading');
  loadingElement.innerHTML = '<div class="spinner"></div><p>분석 중...</p>';
  loadingElement.classList.remove('hidden');
}

// 분석 결과 표시
function showAnalysisResult(data) {
  console.log('분석 결과 표시:', data);
  document.getElementById('company-info').classList.add('hidden');
  document.getElementById('loading').classList.add('hidden');
  document.getElementById('error-container').classList.add('hidden');
  
  const resultContainer = document.getElementById('analysis-result');
  resultContainer.classList.remove('hidden');
  
  // 회사 정보 업데이트
  document.getElementById('company-name').textContent = data.name;
  document.getElementById('salary-info').textContent = data.salary || '정보 없음';
  document.getElementById('benefits-info').textContent = data.benefits || '정보 없음';
  document.getElementById('job-fit-info').textContent = data.jobFit || '정보 없음';
  document.getElementById('rating-text').textContent = data.summary || '정보 없음';
  
  // 별점 업데이트
  updateStars(data.rating || 0);
  
  // "돌아가기" 버튼 추가
  if (!document.querySelector('.back-to-list-btn')) {
    const backBtn = document.createElement('button');
    backBtn.textContent = '회사 목록으로 돌아가기';
    backBtn.className = 'back-to-list-btn';
    backBtn.style.marginTop = '12px';
    
    backBtn.addEventListener('click', () => {
      // 현재 탭에서 다시 회사 정보 요청
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(
          tabs[0].id, 
          { action: 'checkCompanyInfo' },
          (response) => {
            if (response && response.companiesInfo) {
              showCompanyList(response.companiesInfo, tabs[0].id);
            } else {
              showStatus('회사 정보를 찾을 수 없습니다.');
            }
          }
        );
      });
    });
    
    resultContainer.appendChild(backBtn);
  }
}

// 별점 표시 업데이트
function updateStars(rating) {
  console.log('별점 업데이트:', rating);
  const stars = document.querySelectorAll('.star');
  stars.forEach(star => {
    const starRating = parseInt(star.getAttribute('data-rating'));
    if (starRating <= rating) {
      star.classList.add('active');
    } else {
      star.classList.remove('active');
    }
  });
}

// 회사 분석 요청
function analyzeCompany(companyInfo) {
  console.log('회사 분석 요청:', companyInfo);
  
  // 타임아웃 설정
  let isTimedOut = false;
  let responseReceived = false;
  
  // 10초 타임아웃 설정
  const timeoutId = setTimeout(() => {
    if (!responseReceived) {
      isTimedOut = true;
      console.warn('분석 요청 타임아웃');
      showError('분석 요청 타임아웃 - 모의 데이터로 전환합니다.');
      const mockData = getMockAnalysisData(companyInfo.name);
      showAnalysisResult(mockData);
    }
  }, 1000000);
  
  // 백그라운드 스크립트에 분석 요청
  chrome.runtime.sendMessage(
    { action: 'analyzeCompany', companyInfo },
    (response) => {
      responseReceived = true;
      clearTimeout(timeoutId);
      
      // 이미 타임아웃으로 모의 데이터를 표시한 경우 무시
      if (isTimedOut) return;
      
      console.log('분석 응답 수신:', response);
      if (response && response.success) {
        showAnalysisResult(response.data);
      } else {
        console.error('분석 오류:', response);
        showError('분석 오류: ' + (response?.error || '알 수 없는 오류'));
        
        // 오류 발생 시 모의 데이터 사용
        const mockData = getMockAnalysisData(companyInfo.name);
        showAnalysisResult(mockData);
      }
    }
  );
}

// 모의 분석 데이터 생성
function getMockAnalysisData(companyName) {
  // 모의 데이터 테이블
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
      salary: '기술 업계 상위권 연봉으로, 직급과 경력에 따라 다르지만 대체로 시장 평균보다 20-30% 높은 편입니다.',
      benefits: '건강보험, 퇴직연금, 자유로운 휴가, 원격 근무 등 다양한 복지 혜택과 함께 일과 삶의 균형을 중시합니다.',
      jobFit: '소프트웨어 개발, 클라우드 서비스, AI 등 다양한 기술 분야 경력을 쌓을 수 있으며, 글로벌 팀과의 협업 기회가 많습니다.',
      rating: 5,
      summary: '안정적인 대기업으로 글로벌 프로젝트 경험과 좋은 복지 혜택을 제공합니다.'
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
  
  // 대소문자 구분 없이 회사명 찾기 시도
  const normalizedName = companyName.toLowerCase().trim();
  
  for (const [key, value] of Object.entries(mockAnalyses)) {
    if (key.toLowerCase().includes(normalizedName) || 
        normalizedName.includes(key.toLowerCase())) {
      console.log(`모의 분석 일치: ${companyName} -> ${key}`);
      return { ...value, name: companyName };  // 원래 회사명 유지
    }
  }
  
  // 일치하는 회사가 없으면 기본 분석 결과 생성
  return {
    name: companyName,
    salary: '해당 회사의 연봉 정보는 현재 충분한 데이터가 없어 정확한 분석이 어렵습니다.',
    benefits: '회사의 복지 제도에 대한 상세 정보가 제한적입니다.',
    jobFit: '직무 적합도를 평가하기 위한 충분한 정보가 없습니다.',
    rating: 3,
    summary: '추가 정보가 필요한 회사입니다.'
  };
} 